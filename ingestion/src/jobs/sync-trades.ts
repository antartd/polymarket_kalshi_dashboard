import { pool } from "../db.js";
import { fetchKalshiTrades } from "../adapters/kalshi.js";
import { fetchPolymarketTrades } from "../adapters/polymarket.js";
import { fetchPolymarketGraphFallback } from "../adapters/polymarket-graph-fallback.js";
import { getCursor, markAttempt, setCursor } from "../state/cursor-store.js";

type NormalizedTrade = {
  id: string;
  platform: "polymarket" | "kalshi";
  sourceTradeId: string;
  marketId: string;
  tradeTs: string;
  volumeUsd: string;
};

async function upsertTrades(trades: NormalizedTrade[]) {
  if (trades.length === 0) {
    return;
  }

  for (const trade of trades) {
    await pool.query(
      `
        INSERT INTO raw_trades (id, platform, source_trade_id, market_id, trade_ts, volume_usd)
        VALUES ($1, $2, $3, $4, $5::timestamptz, $6::numeric)
        ON CONFLICT (id) DO NOTHING
      `,
      [
        trade.id,
        trade.platform,
        trade.sourceTradeId,
        trade.marketId,
        trade.tradeTs,
        trade.volumeUsd,
      ],
    );
  }
}

export async function runTradeSyncJob() {
  await markAttempt("trade-sync", { stage: "start" });

  const polymarketCursor = await getCursor("polymarket-trades");
  try {
    const polymarket = await fetchPolymarketTrades(polymarketCursor);
    await upsertTrades([]);
    await setCursor("polymarket-trades", polymarket.nextCursor, {
      source: polymarket.source,
      trade_count: polymarket.trades.length,
    });
  } catch (error) {
    const fallback = await fetchPolymarketGraphFallback(polymarketCursor);
    await upsertTrades([]);
    await setCursor("polymarket-trades", fallback.nextCursor, {
      source: fallback.source,
      trade_count: fallback.trades.length,
      fallback: true,
      fallback_reason: error instanceof Error ? error.message : "unknown",
    });
  }

  const kalshiCursor = await getCursor("kalshi-trades");
  const kalshi = await fetchKalshiTrades(kalshiCursor);
  await upsertTrades([]);
  await setCursor("kalshi-trades", kalshi.nextCursor, {
    source: kalshi.source,
    trade_count: kalshi.trades.length,
  });

  await setCursor("trade-sync", new Date().toISOString(), { ok: true });
}
