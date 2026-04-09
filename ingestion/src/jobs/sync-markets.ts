import { fetchKalshiTrades } from "../adapters/kalshi.js";
import { fetchPolymarketTrades } from "../adapters/polymarket.js";
import { fetchPolymarketGraphFallback } from "../adapters/polymarket-graph-fallback.js";
import { markAttempt, setCursor, getCursor } from "../state/cursor-store.js";

export async function runMarketSyncJob() {
  const sourceName = "market-sync";
  await markAttempt(sourceName, { stage: "start" });

  const pmCursor = await getCursor("polymarket-markets");

  try {
    const polymarket = await fetchPolymarketTrades(pmCursor);
    await setCursor("polymarket-markets", polymarket.nextCursor, {
      source: polymarket.source,
      market_count: polymarket.markets.length,
    });
  } catch (error) {
    const fallback = await fetchPolymarketGraphFallback(pmCursor);
    await setCursor("polymarket-markets", fallback.nextCursor, {
      source: fallback.source,
      market_count: fallback.markets.length,
      fallback: true,
      fallback_reason: error instanceof Error ? error.message : "unknown",
    });
  }

  const kalshiCursor = await getCursor("kalshi-markets");
  const kalshi = await fetchKalshiTrades(kalshiCursor);
  await setCursor("kalshi-markets", kalshi.nextCursor, {
    source: kalshi.source,
    market_count: kalshi.markets.length,
  });

  await setCursor(sourceName, new Date().toISOString(), { ok: true });
}
