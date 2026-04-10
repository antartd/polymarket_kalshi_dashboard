import { config } from "../config.js";

const DEFAULT_LIMIT = 500;
const MAX_BOOTSTRAP_PAGES = 10;
const BOOTSTRAP_DAYS = 90;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
    },
  });
  if (!response.ok) {
    const error = new Error(`Polymarket request failed (${response.status}): ${url}`) as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }
  return (await response.json()) as T;
}

type PolymarketFetchResult = {
  source: "polymarket-api";
  nextCursor: string;
  trades: Array<Record<string, unknown>>;
  markets: Array<Record<string, unknown>>;
};

function parseNumericTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1_000_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed > 1_000_000_000_000 ? Math.floor(parsed / 1000) : Math.floor(parsed);
    }
  }
  return null;
}

export async function fetchPolymarketTrades(cursor: string | null): Promise<PolymarketFetchResult> {
  const lastSeenTs = Number(cursor ?? "0");
  const safeLastSeenTs = Number.isFinite(lastSeenTs) && lastSeenTs >= 0 ? lastSeenTs : 0;

  const marketsUrl = new URL("/markets", config.polymarketGammaBase);
  marketsUrl.searchParams.set("active", "true");
  marketsUrl.searchParams.set("closed", "false");
  marketsUrl.searchParams.set("limit", String(DEFAULT_LIMIT));
  marketsUrl.searchParams.set("offset", "0");

  const marketsPromise = fetchJson<Array<Record<string, unknown>>>(marketsUrl.toString());

  const nowTs = Math.floor(Date.now() / 1000);
  const bootstrapMinTs = nowTs - BOOTSTRAP_DAYS * 24 * 60 * 60;
  const shouldBootstrap = safeLastSeenTs === 0;
  const minAcceptedTs = shouldBootstrap ? bootstrapMinTs : safeLastSeenTs + 1;

  const trades: Array<Record<string, unknown>> = [];
  const seenTradeKey = new Set<string>();
  for (let page = 0; page < MAX_BOOTSTRAP_PAGES; page += 1) {
    const offset = page * DEFAULT_LIMIT;
    const tradesUrl = new URL("/trades", config.polymarketDataBase);
    tradesUrl.searchParams.set("limit", String(DEFAULT_LIMIT));
    tradesUrl.searchParams.set("offset", String(offset));
    tradesUrl.searchParams.set("takerOnly", "false");

    let pageTrades: Array<Record<string, unknown>>;
    try {
      pageTrades = await fetchJson<Array<Record<string, unknown>>>(tradesUrl.toString());
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 400) {
        break;
      }
      throw error;
    }
    if (pageTrades.length === 0) {
      break;
    }

    let reachedOlderHistory = false;
    for (const trade of pageTrades) {
      const ts = parseNumericTimestamp(trade.timestamp);
      if (ts === null) {
        continue;
      }
      if (ts < minAcceptedTs) {
        reachedOlderHistory = true;
        continue;
      }

      const key =
        typeof trade.transactionHash === "string"
          ? `${trade.transactionHash}:${trade.conditionId ?? ""}:${trade.timestamp ?? ""}`
          : `${trade.conditionId ?? ""}:${trade.timestamp ?? ""}`;
      if (seenTradeKey.has(key)) {
        continue;
      }
      seenTradeKey.add(key);
      trades.push(trade);
    }

    if (!shouldBootstrap || reachedOlderHistory) {
      break;
    }
  }

  const markets = await marketsPromise;

  const filteredTrades = trades;

  const maxObservedTs = filteredTrades.reduce((maxTs, trade) => {
    const ts = parseNumericTimestamp(trade.timestamp);
    if (ts === null) {
      return maxTs;
    }
    return Math.max(maxTs, ts);
  }, safeLastSeenTs);

  return {
    source: "polymarket-api",
    nextCursor: String(maxObservedTs),
    trades: filteredTrades,
    markets,
  };
}
