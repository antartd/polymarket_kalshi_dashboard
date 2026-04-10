import { pool } from "../db.js";
import { config } from "../config.js";
import { normalizeKalshiMarket, normalizePolymarketMarket } from "../normalize/market.js";
import { normalizeKalshiTrade, normalizePolymarketTrade } from "../normalize/trade.js";
import { getCursor, getStateMetadata, setCursor, markAttempt } from "../state/cursor-store.js";
import { runRefreshAggregatesJob } from "./refresh-aggregates.js";
import { upsertMarkets, upsertTrades } from "./upsert.js";

type GenericPayload = {
  markets?: Array<Record<string, unknown>>;
  trades?: Array<Record<string, unknown>>;
  cursor?: string;
};

type BackfillTradeStats = {
  totalFetched: number;
  totalNormalized: number;
  totalInserted: number;
  marketsSelected: number;
  marketsProcessed: number;
  requests: number;
};

const BACKFILL_VERSION = 4;
const PAGE_LIMIT = Number(process.env.AUTO_BACKFILL_PAGE_LIMIT ?? 500);
const MAX_PAGES = Number(process.env.AUTO_BACKFILL_MAX_PAGES ?? 200);
const PER_MARKET_MAX_PAGES = Number(process.env.AUTO_BACKFILL_PER_MARKET_MAX_PAGES ?? 6);
const MARKETS_PER_PLATFORM = Number(process.env.AUTO_BACKFILL_MARKETS_PER_PLATFORM ?? 120);
const FORCE = process.env.AUTO_BACKFILL_FORCE === "1";
const REFRESH_EVERY_REQUESTS = Number(process.env.AUTO_BACKFILL_REFRESH_EVERY_REQUESTS ?? 40);
const SAFE_REFRESH_EVERY_REQUESTS =
  Number.isFinite(REFRESH_EVERY_REQUESTS) && REFRESH_EVERY_REQUESTS >= 1
    ? Math.floor(REFRESH_EVERY_REQUESTS)
    : 0;
const REQUIRE_KALSHI_COVERAGE_CHECK = process.env.AUTO_BACKFILL_REQUIRE_KALSHI_COVERAGE !== "0";
const MIN_KALSHI_TRADES = Number(process.env.AUTO_BACKFILL_MIN_KALSHI_TRADES ?? 5000);
const MIN_KALSHI_DAYS = Number(process.env.AUTO_BACKFILL_MIN_KALSHI_DAYS ?? 14);
const MIN_KALSHI_MARKETS = Number(process.env.AUTO_BACKFILL_MIN_KALSHI_MARKETS ?? 100);

type KalshiCoverage = {
  trades: number;
  days: number;
  markets: number;
};

async function getKalshiCoverage(): Promise<KalshiCoverage> {
  const result = await pool.query<{
    trades: string | number | null;
    days: string | number | null;
    markets: string | number | null;
  }>(
    `
      SELECT
        COUNT(*)::bigint AS trades,
        COUNT(DISTINCT DATE(trade_ts))::bigint AS days,
        COUNT(DISTINCT market_id)::bigint AS markets
      FROM raw_trades
      WHERE platform = 'kalshi'
    `,
  );

  const row = result.rows[0];
  return {
    trades: Number(row?.trades ?? 0),
    days: Number(row?.days ?? 0),
    markets: Number(row?.markets ?? 0),
  };
}

async function shouldReRunForCoverage(): Promise<{ shouldRun: boolean; coverage: KalshiCoverage }> {
  const coverage = await getKalshiCoverage();
  const shouldRun =
    coverage.trades < MIN_KALSHI_TRADES ||
    coverage.days < MIN_KALSHI_DAYS ||
    coverage.markets < MIN_KALSHI_MARKETS;
  return { shouldRun, coverage };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    const error = new Error(`Request failed (${response.status}): ${url}`) as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }
  return (await response.json()) as T;
}

async function loadBackfillMarketIds(platform: "polymarket" | "kalshi"): Promise<string[]> {
  const safeLimit = Number.isFinite(MARKETS_PER_PLATFORM) && MARKETS_PER_PLATFORM > 0
    ? Math.max(1, Math.floor(MARKETS_PER_PLATFORM))
    : 120;
  const half = Math.ceil(safeLimit / 2);

  const result = await pool.query<{ source_market_id: string }>(
    `
      WITH ranked AS (
        SELECT
          source_market_id,
          COALESCE(close_time, open_time, updated_at) AS ts
        FROM source_markets
        WHERE platform = $1
      ),
      mixed AS (
        (
          SELECT source_market_id, ts
          FROM ranked
          ORDER BY ts DESC NULLS LAST
          LIMIT $2
        )
        UNION
        (
          SELECT source_market_id, ts
          FROM ranked
          ORDER BY ts ASC NULLS LAST
          LIMIT $3
        )
      )
      SELECT source_market_id
      FROM mixed
      LIMIT $4
    `,
    [platform, half, half, safeLimit],
  );

  return result.rows
    .map((row) => row.source_market_id)
    .filter((id) => typeof id === "string" && id.trim() !== "");
}

async function loadBackfillKalshiTickers(): Promise<string[]> {
  const safeLimit = Number.isFinite(MARKETS_PER_PLATFORM) && MARKETS_PER_PLATFORM > 0
    ? Math.max(1, Math.floor(MARKETS_PER_PLATFORM))
    : 120;
  const half = Math.ceil(safeLimit / 2);

  const result = await pool.query<{ source_market_id: string }>(
    `
      WITH ranked AS (
        SELECT
          source_market_id,
          COALESCE(close_time, open_time, updated_at) AS ts,
          COALESCE(NULLIF(metadata->>'volume_fp', '')::numeric, 0) AS volume_fp
        FROM source_markets
        WHERE platform = 'kalshi'
      ),
      nonzero_new AS (
        SELECT source_market_id, ts
        FROM ranked
        WHERE volume_fp > 0
        ORDER BY ts DESC NULLS LAST, volume_fp DESC
        LIMIT $1
      ),
      nonzero_old AS (
        SELECT source_market_id, ts
        FROM ranked
        WHERE volume_fp > 0
        ORDER BY ts ASC NULLS LAST, volume_fp DESC
        LIMIT $2
      ),
      fallback_recent AS (
        SELECT source_market_id, ts
        FROM ranked
        ORDER BY ts DESC NULLS LAST
        LIMIT $3
      ),
      combined AS (
        SELECT source_market_id, ts FROM nonzero_new
        UNION
        SELECT source_market_id, ts FROM nonzero_old
        UNION
        SELECT source_market_id, ts FROM fallback_recent
      )
      SELECT source_market_id
      FROM combined
      ORDER BY ts DESC NULLS LAST
      LIMIT $4
    `,
    [half, half, safeLimit, safeLimit],
  );

  const dbTickers = result.rows
    .map((row) => row.source_market_id)
    .filter((id) => typeof id === "string" && id.trim() !== "");

  if (dbTickers.length >= safeLimit) {
    return dbTickers.slice(0, safeLimit);
  }

  const apiTickers = await loadKalshiTickersFromApi(safeLimit * 2);
  const merged = new Set<string>(dbTickers);
  for (const ticker of apiTickers) {
    merged.add(ticker);
    if (merged.size >= safeLimit) {
      break;
    }
  }
  return Array.from(merged).slice(0, safeLimit);
}

async function loadKalshiTickersFromApi(limit: number): Promise<string[]> {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 240;
  const statuses = ["closed", "settled", "open"] as const;
  const pageBudget = Math.max(1, Math.min(MAX_PAGES, 60));
  const tickers: string[] = [];
  const seen = new Set<string>();

  for (const status of statuses) {
    let cursor: string | null = null;
    const seenCursors = new Set<string>();
    let pages = 0;

    while (pages < pageBudget && tickers.length < safeLimit) {
      const url = new URL("markets", `${config.kalshiApiBase.replace(/\/+$/, "")}/`);
      url.searchParams.set("limit", String(PAGE_LIMIT));
      url.searchParams.set("status", status);
      if (cursor) {
        url.searchParams.set("cursor", cursor);
      }

      let payload: GenericPayload;
      try {
        payload = await fetchJson<GenericPayload>(url.toString());
      } catch (error) {
        console.error("[auto-backfill][kalshi-tickers] failed", {
          status,
          error: error instanceof Error ? error.message : String(error),
        });
        break;
      }

      pages += 1;
      const rows = payload.markets ?? [];
      if (rows.length === 0) {
        break;
      }

      for (const market of rows) {
        const ticker = typeof market.ticker === "string" ? market.ticker.trim() : "";
        const volume = Number(market.volume_fp ?? 0);
        if (!ticker || !Number.isFinite(volume) || volume <= 0 || seen.has(ticker)) {
          continue;
        }
        seen.add(ticker);
        tickers.push(ticker);
        if (tickers.length >= safeLimit) {
          break;
        }
      }

      const nextCursor = payload.cursor?.trim() ?? "";
      if (!nextCursor || seenCursors.has(nextCursor)) {
        break;
      }
      seenCursors.add(nextCursor);
      cursor = nextCursor;
    }
  }

  return tickers;
}

async function backfillPolymarketMarkets() {
  let totalFetched = 0;
  let totalNormalized = 0;
  let totalAffected = 0;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const offset = page * PAGE_LIMIT;
    let rows: Array<Record<string, unknown>> = [];

    const gammaUrl = new URL("/markets", config.polymarketGammaBase);
    gammaUrl.searchParams.set("limit", String(PAGE_LIMIT));
    gammaUrl.searchParams.set("offset", String(offset));

    try {
      rows = await fetchJson<Array<Record<string, unknown>>>(gammaUrl.toString());
    } catch (primaryError) {
      const graphUrl = config.polymarketGraphUrl;
      const query = `
        query BackfillMarkets($first: Int!, $skip: Int!) {
          markets(first: $first, skip: $skip) {
            id
            question
          }
        }
      `;
      try {
        const graphResponse = await fetch(graphUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            query,
            variables: {
              first: PAGE_LIMIT,
              skip: offset,
            },
          }),
        });
        if (!graphResponse.ok) {
          throw new Error(`Graph fallback failed (${graphResponse.status})`);
        }
        const payload = (await graphResponse.json()) as { data?: { markets?: Array<Record<string, unknown>> } };
        rows = payload.data?.markets ?? [];
      } catch (fallbackError) {
        console.error("[auto-backfill][polymarket-markets] primary and fallback failed", {
          primary_error: primaryError instanceof Error ? primaryError.message : "unknown",
          fallback_error: fallbackError instanceof Error ? fallbackError.message : "unknown",
        });
        break;
      }
    }

    if (rows.length === 0) {
      break;
    }
    totalFetched += rows.length;

    const normalized = rows
      .map(normalizePolymarketMarket)
      .filter((item): item is NonNullable<typeof item> => item !== null);
    totalNormalized += normalized.length;

    const upsertStats = await upsertMarkets(normalized);
    totalAffected += upsertStats.affected;

    if (rows.length < PAGE_LIMIT) {
      break;
    }
  }

  return { totalFetched, totalNormalized, totalAffected };
}

async function backfillPolymarketTrades(): Promise<BackfillTradeStats> {
  let totalFetched = 0;
  let totalNormalized = 0;
  let totalInserted = 0;
  let requests = 0;
  let marketsProcessed = 0;
  const marketIds = await loadBackfillMarketIds("polymarket");
  let globalPageBudget = MAX_PAGES;

  for (const marketId of marketIds) {
    if (globalPageBudget <= 0) {
      break;
    }

    let touched = false;
    for (let page = 0; page < PER_MARKET_MAX_PAGES && globalPageBudget > 0; page += 1) {
      const offset = page * PAGE_LIMIT;
      const url = new URL("/trades", config.polymarketDataBase);
      url.searchParams.set("limit", String(PAGE_LIMIT));
      url.searchParams.set("offset", String(offset));
      url.searchParams.set("takerOnly", "false");
      url.searchParams.set("market", marketId);

      let rows: Array<Record<string, unknown>>;
      requests += 1;
      globalPageBudget -= 1;
      try {
        rows = await fetchJson<Array<Record<string, unknown>>>(url.toString());
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (status === 400 || status === 404) {
          break;
        }
        console.error("[auto-backfill][polymarket-trades] failed", {
          market_id: marketId,
          error: error instanceof Error ? error.message : String(error),
        });
        break;
      }

      if (rows.length === 0) {
        break;
      }
      touched = true;
      totalFetched += rows.length;

      const normalized = rows
        .map(normalizePolymarketTrade)
        .filter((item): item is NonNullable<typeof item> => item !== null);
      totalNormalized += normalized.length;

      const upsertStats = await upsertTrades(normalized);
      totalInserted += upsertStats.inserted;

      if (SAFE_REFRESH_EVERY_REQUESTS > 0 && requests % SAFE_REFRESH_EVERY_REQUESTS === 0) {
        await runRefreshAggregatesJob();
      }

      if (rows.length < PAGE_LIMIT) {
        break;
      }
    }

    if (touched) {
      marketsProcessed += 1;
    }
  }

  return {
    totalFetched,
    totalNormalized,
    totalInserted,
    marketsSelected: marketIds.length,
    marketsProcessed,
    requests,
  };
}

async function backfillKalshiMarkets() {
  let totalFetched = 0;
  let totalNormalized = 0;
  let totalAffected = 0;
  const statuses = ["closed", "settled", "open"] as const;
  const closedBudget = Math.max(1, Math.floor(MAX_PAGES * 0.7));
  const settledBudget = Math.max(1, Math.floor(MAX_PAGES * 0.2));
  const openBudget = Math.max(0, MAX_PAGES - closedBudget - settledBudget);
  const statusBudgets: Record<(typeof statuses)[number], number> = {
    closed: closedBudget,
    settled: settledBudget,
    open: openBudget,
  };

  for (const status of statuses) {
    let statusPages = 0;
    let cursor: string | null = null;
    const seenCursors = new Set<string>();

    while (statusPages < statusBudgets[status]) {
      const url = new URL("markets", `${config.kalshiApiBase.replace(/\/+$/, "")}/`);
      url.searchParams.set("limit", String(PAGE_LIMIT));
      url.searchParams.set("status", status);
      if (cursor) {
        url.searchParams.set("cursor", cursor);
      }

      const payload = await fetchJson<GenericPayload>(url.toString());
      statusPages += 1;

      const rows = payload.markets ?? [];
      if (rows.length === 0) {
        break;
      }
      totalFetched += rows.length;

      const normalized = rows
        .map(normalizeKalshiMarket)
        .filter((item): item is NonNullable<typeof item> => item !== null);
      totalNormalized += normalized.length;

      const upsertStats = await upsertMarkets(normalized);
      totalAffected += upsertStats.affected;

      if (!payload.cursor || payload.cursor.trim() === "") {
        break;
      }
      const nextCursor = payload.cursor.trim();
      if (seenCursors.has(nextCursor)) {
        break;
      }
      seenCursors.add(nextCursor);
      cursor = nextCursor;
    }

  }

  return { totalFetched, totalNormalized, totalAffected };
}

async function backfillKalshiTrades(): Promise<BackfillTradeStats> {
  let totalFetched = 0;
  let totalNormalized = 0;
  let totalInserted = 0;
  let requests = 0;
  let marketsProcessed = 0;
  const tickers = await loadBackfillKalshiTickers();
  let globalPageBudget = MAX_PAGES;

  for (const ticker of tickers) {
    if (globalPageBudget <= 0) {
      break;
    }

    let touched = false;
    let cursor: string | null = null;
    const seenCursors = new Set<string>();

    for (let page = 0; page < PER_MARKET_MAX_PAGES && globalPageBudget > 0; page += 1) {
      const url = new URL("markets/trades", `${config.kalshiApiBase.replace(/\/+$/, "")}/`);
      url.searchParams.set("limit", String(PAGE_LIMIT));
      url.searchParams.set("ticker", ticker);
      if (cursor) {
        url.searchParams.set("cursor", cursor);
      }

      requests += 1;
      globalPageBudget -= 1;
      let payload: GenericPayload;
      try {
        payload = await fetchJson<GenericPayload>(url.toString());
      } catch (error) {
        console.error("[auto-backfill][kalshi-trades] failed", {
          ticker,
          error: error instanceof Error ? error.message : String(error),
        });
        break;
      }

      const rows = payload.trades ?? [];
      if (rows.length === 0) {
        break;
      }
      touched = true;
      totalFetched += rows.length;

      const normalized = rows
        .map(normalizeKalshiTrade)
        .filter((item): item is NonNullable<typeof item> => item !== null);
      totalNormalized += normalized.length;

      const upsertStats = await upsertTrades(normalized);
      totalInserted += upsertStats.inserted;

      if (SAFE_REFRESH_EVERY_REQUESTS > 0 && requests % SAFE_REFRESH_EVERY_REQUESTS === 0) {
        await runRefreshAggregatesJob();
      }

      const nextCursor = payload.cursor?.trim() ?? "";
      if (nextCursor === "") {
        break;
      }
      if (seenCursors.has(nextCursor)) {
        break;
      }
      seenCursors.add(nextCursor);
      cursor = nextCursor;
    }

    if (touched) {
      marketsProcessed += 1;
    }
  }

  return {
    totalFetched,
    totalNormalized,
    totalInserted,
    marketsSelected: tickers.length,
    marketsProcessed,
    requests,
  };
}

export async function runAutoBackfillJob() {
  const existingMeta = await getStateMetadata("auto-backfill");
  const existingVersion = Number(existingMeta?.version ?? 0);
  const isAlreadyCompleted = existingMeta?.status === "completed" && existingVersion === BACKFILL_VERSION;
  let coverageDecision: { shouldRun: boolean; coverage: KalshiCoverage } | null = null;

  if (!FORCE && isAlreadyCompleted && REQUIRE_KALSHI_COVERAGE_CHECK) {
    coverageDecision = await shouldReRunForCoverage();
    if (coverageDecision.shouldRun) {
      console.warn("[auto-backfill] re-running due to low Kalshi coverage", {
        coverage: coverageDecision.coverage,
        thresholds: {
          min_trades: MIN_KALSHI_TRADES,
          min_days: MIN_KALSHI_DAYS,
          min_markets: MIN_KALSHI_MARKETS,
        },
      });
    }
  }

  if (!FORCE && isAlreadyCompleted && !coverageDecision?.shouldRun) {
    console.log("[auto-backfill] skipped (already completed)");
    return;
  }

  console.log("[auto-backfill] started", {
    version: BACKFILL_VERSION,
    force: FORCE,
    previous_version: existingVersion,
  });
  await markAttempt("auto-backfill", {
    version: BACKFILL_VERSION,
    status: "running",
    started_at: new Date().toISOString(),
    rerun_for_coverage: coverageDecision?.shouldRun ?? false,
    kalshi_coverage_before: coverageDecision?.coverage ?? null,
  });

  const pmMarkets = await backfillPolymarketMarkets();
  const pmTrades = await backfillPolymarketTrades();
  const kMarkets = await backfillKalshiMarkets();
  const kTrades = await backfillKalshiTrades();

  await runRefreshAggregatesJob();
  await setCursor("auto-backfill", new Date().toISOString(), {
    version: BACKFILL_VERSION,
    status: "completed",
    completed_at: new Date().toISOString(),
    rerun_for_coverage: coverageDecision?.shouldRun ?? false,
    kalshi_coverage_before: coverageDecision?.coverage ?? null,
    page_limit: PAGE_LIMIT,
    max_pages: MAX_PAGES,
    per_market_max_pages: PER_MARKET_MAX_PAGES,
    markets_per_platform: MARKETS_PER_PLATFORM,
    polymarket_markets: pmMarkets,
    polymarket_trades: pmTrades,
    kalshi_markets: kMarkets,
    kalshi_trades: kTrades,
  });

  const latestPolymarketCursor = await getCursor("polymarket-trades");
  const latestKalshiCursor = await getCursor("kalshi-trades");
  console.log("[auto-backfill] completed", {
    version: BACKFILL_VERSION,
    polymarket_trades_cursor: latestPolymarketCursor,
    kalshi_trades_cursor: latestKalshiCursor,
    polymarket_trades_inserted: pmTrades.totalInserted,
    kalshi_trades_inserted: kTrades.totalInserted,
    polymarket_markets_processed: pmTrades.marketsProcessed,
    kalshi_markets_processed: kTrades.marketsProcessed,
  });
}
