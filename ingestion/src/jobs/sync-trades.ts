import { fetchKalshiTrades } from "../adapters/kalshi.js";
import { fetchPolymarketTrades } from "../adapters/polymarket.js";
import { fetchPolymarketGraphFallback } from "../adapters/polymarket-graph-fallback.js";
import { normalizeKalshiTrade, normalizePolymarketTrade } from "../normalize/trade.js";
import { getCursor, getStateMetadata, markAttempt, setCursor } from "../state/cursor-store.js";
import { upsertTrades } from "./upsert.js";

export async function runTradeSyncJob() {
  await markAttempt("trade-sync", { stage: "start" });

  const polymarketCursor = await getCursor("polymarket-trades");
  try {
    const polymarket = await fetchPolymarketTrades(polymarketCursor);
    const normalizedTrades = polymarket.trades
      .map(normalizePolymarketTrade)
      .filter((item): item is NonNullable<typeof item> => item !== null);
    const upsertStats = await upsertTrades(normalizedTrades);
    console.log(
      `[ingestion][polymarket-trades] fetched=${polymarket.trades.length} normalized=${normalizedTrades.length} inserted=${upsertStats.inserted}`,
    );
    await setCursor("polymarket-trades", polymarket.nextCursor, {
      source: polymarket.source,
      trade_count: normalizedTrades.length,
    });
  } catch (primaryError) {
    try {
      const fallback = await fetchPolymarketGraphFallback(polymarketCursor);
      const normalizedTrades = fallback.trades
        .map(normalizePolymarketTrade)
        .filter((item): item is NonNullable<typeof item> => item !== null);
      const upsertStats = await upsertTrades(normalizedTrades);
      console.log(
        `[ingestion][polymarket-trades:fallback] fetched=${fallback.trades.length} normalized=${normalizedTrades.length} inserted=${upsertStats.inserted}`,
      );
      await setCursor("polymarket-trades", fallback.nextCursor, {
        source: fallback.source,
        trade_count: normalizedTrades.length,
        fallback: true,
        fallback_reason: primaryError instanceof Error ? primaryError.message : "unknown",
      });
    } catch (fallbackError) {
      console.error("[ingestion][polymarket-trades] primary and fallback failed", {
        primary_error: primaryError instanceof Error ? primaryError.message : "unknown",
        fallback_error: fallbackError instanceof Error ? fallbackError.message : "unknown",
      });
      await markAttempt("polymarket-trades", {
        status: "failed",
        primary_error: primaryError instanceof Error ? primaryError.message : "unknown",
        fallback_error: fallbackError instanceof Error ? fallbackError.message : "unknown",
      });
    }
  }

  const kalshiCursor = await getCursor("kalshi-trades");
  const kalshiMeta = await getStateMetadata("kalshi-trades");
  const resumePageCursor =
    typeof kalshiMeta?.pagination_cursor === "string" && kalshiMeta.pagination_cursor.trim() !== ""
      ? kalshiMeta.pagination_cursor.trim()
      : null;
  const kalshi = await fetchKalshiTrades(kalshiCursor, {
    paginationCursor: resumePageCursor,
  });
  const kalshiTrades = kalshi.trades
    .map(normalizeKalshiTrade)
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const upsertStats = await upsertTrades(kalshiTrades);
  console.log(
    `[ingestion][kalshi-trades] fetched=${kalshi.trades.length} normalized=${kalshiTrades.length} inserted=${upsertStats.inserted} pages=${kalshi.pages} min_ts=${kalshi.minTs} resume_cursor=${resumePageCursor ? "yes" : "no"} next_cursor=${kalshi.nextPaginationCursor ? "yes" : "no"}`,
  );
  await setCursor("kalshi-trades", kalshi.nextCursor, {
    source: kalshi.source,
    trade_count: kalshiTrades.length,
    pages: kalshi.pages,
    min_ts: kalshi.minTs,
    window_exhausted: kalshi.windowExhausted,
    pagination_cursor: kalshi.nextPaginationCursor,
  });

  await setCursor("trade-sync", new Date().toISOString(), { ok: true });
}
