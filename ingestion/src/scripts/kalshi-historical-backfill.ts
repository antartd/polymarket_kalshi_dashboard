import { config } from "../config.js";
import { normalizeKalshiMarket } from "../normalize/market.js";
import { normalizeKalshiTrade } from "../normalize/trade.js";
import { upsertMarkets, upsertTrades } from "../jobs/upsert.js";
import { runRefreshAggregatesJob } from "../jobs/refresh-aggregates.js";

type MarketsPayload = {
  markets?: Array<Record<string, unknown>>;
  cursor?: string;
};

type TradesPayload = {
  trades?: Array<Record<string, unknown>>;
};

const MARKET_PAGES = Number(process.env.KALSHI_HISTORY_MARKET_PAGES ?? 40);
const MARKET_LIMIT = Number(process.env.KALSHI_HISTORY_MARKET_LIMIT ?? 500);
const TRADE_LIMIT = Number(process.env.KALSHI_HISTORY_TRADE_LIMIT ?? 500);
const TICKER_LIMIT = Number(process.env.KALSHI_HISTORY_TICKER_LIMIT ?? 800);

async function main() {
  const base = `${config.kalshiApiBase.replace(/\/+$/, "")}/`;
  let cursor: string | null = null;
  let marketPages = 0;
  let marketRows = 0;
  const tickers: string[] = [];
  const seenTickers = new Set<string>();

  while (marketPages < MARKET_PAGES) {
    const url = new URL("markets", base);
    url.searchParams.set("status", "closed");
    url.searchParams.set("limit", String(MARKET_LIMIT));
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`Kalshi markets request failed (${response.status})`);
    }
    const payload = (await response.json()) as MarketsPayload;
    const markets = payload.markets ?? [];
    if (markets.length === 0) {
      break;
    }

    marketPages += 1;
    marketRows += markets.length;

    const normalized = markets
      .map(normalizeKalshiMarket)
      .filter((item): item is NonNullable<typeof item> => item !== null);
    await upsertMarkets(normalized);

    for (const market of markets) {
      const ticker = typeof market.ticker === "string" ? market.ticker.trim() : "";
      const volume = Number(market.volume_fp ?? 0);
      if (!ticker || !Number.isFinite(volume) || volume <= 0 || seenTickers.has(ticker)) {
        continue;
      }
      seenTickers.add(ticker);
      tickers.push(ticker);
    }

    const nextCursor = payload.cursor?.trim() ?? "";
    if (!nextCursor) {
      break;
    }
    cursor = nextCursor;
  }

  let tradesFetched = 0;
  let tradesInserted = 0;
  let tickersDone = 0;
  for (const ticker of tickers.slice(0, TICKER_LIMIT)) {
    const url = new URL("markets/trades", base);
    url.searchParams.set("ticker", ticker);
    url.searchParams.set("limit", String(TRADE_LIMIT));

    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) {
      continue;
    }
    const payload = (await response.json()) as TradesPayload;
    const trades = payload.trades ?? [];
    if (trades.length === 0) {
      continue;
    }

    tickersDone += 1;
    tradesFetched += trades.length;
    const normalized = trades
      .map(normalizeKalshiTrade)
      .filter((item): item is NonNullable<typeof item> => item !== null);
    const stats = await upsertTrades(normalized);
    tradesInserted += stats.inserted;
  }

  await runRefreshAggregatesJob();
  console.log(
    JSON.stringify({
      market_pages: marketPages,
      market_rows: marketRows,
      tickers_candidate: tickers.length,
      tickers_done: tickersDone,
      trades_fetched: tradesFetched,
      trades_inserted: tradesInserted,
    }),
  );
}

main().catch((error) => {
  console.error("[kalshi-historical-backfill] failed", error);
  process.exit(1);
});

