import { fetchKalshiTrades } from "../adapters/kalshi.js";
import { fetchPolymarketTrades } from "../adapters/polymarket.js";
import { fetchPolymarketGraphFallback } from "../adapters/polymarket-graph-fallback.js";
import { normalizeKalshiMarket, normalizePolymarketMarket } from "../normalize/market.js";
import { markAttempt, setCursor, getCursor } from "../state/cursor-store.js";
import { upsertMarkets } from "./upsert.js";

export async function runMarketSyncJob() {
  const sourceName = "market-sync";
  await markAttempt(sourceName, { stage: "start" });

  const pmCursor = await getCursor("polymarket-markets");

  try {
    const polymarket = await fetchPolymarketTrades(pmCursor);
    const normalized = polymarket.markets
      .map(normalizePolymarketMarket)
      .filter((item): item is NonNullable<typeof item> => item !== null);
    const upsertStats = await upsertMarkets(normalized);
    console.log(
      `[ingestion][polymarket-markets] fetched=${polymarket.markets.length} normalized=${normalized.length} affected=${upsertStats.affected}`,
    );
    await setCursor("polymarket-markets", polymarket.nextCursor, {
      source: polymarket.source,
      market_count: normalized.length,
    });
  } catch (primaryError) {
    try {
      const fallback = await fetchPolymarketGraphFallback(pmCursor);
      const normalized = fallback.markets
        .map(normalizePolymarketMarket)
        .filter((item): item is NonNullable<typeof item> => item !== null);
      const upsertStats = await upsertMarkets(normalized);
      console.log(
        `[ingestion][polymarket-markets:fallback] fetched=${fallback.markets.length} normalized=${normalized.length} affected=${upsertStats.affected}`,
      );
      await setCursor("polymarket-markets", fallback.nextCursor, {
        source: fallback.source,
        market_count: normalized.length,
        fallback: true,
        fallback_reason: primaryError instanceof Error ? primaryError.message : "unknown",
      });
    } catch (fallbackError) {
      console.error("[ingestion][polymarket-markets] primary and fallback failed", {
        primary_error: primaryError instanceof Error ? primaryError.message : "unknown",
        fallback_error: fallbackError instanceof Error ? fallbackError.message : "unknown",
      });
      await markAttempt("polymarket-markets", {
        status: "failed",
        primary_error: primaryError instanceof Error ? primaryError.message : "unknown",
        fallback_error: fallbackError instanceof Error ? fallbackError.message : "unknown",
      });
    }
  }

  const kalshiCursor = await getCursor("kalshi-markets");
  const kalshi = await fetchKalshiTrades(kalshiCursor);
  const kalshiMarkets = kalshi.markets
    .map(normalizeKalshiMarket)
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const upsertStats = await upsertMarkets(kalshiMarkets);
  console.log(
    `[ingestion][kalshi-markets] fetched=${kalshi.markets.length} normalized=${kalshiMarkets.length} affected=${upsertStats.affected}`,
  );
  await setCursor("kalshi-markets", kalshi.nextCursor, {
    source: kalshi.source,
    market_count: kalshiMarkets.length,
  });

  await setCursor(sourceName, new Date().toISOString(), { ok: true });
}
