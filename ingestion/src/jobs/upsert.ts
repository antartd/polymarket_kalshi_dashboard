import { pool } from "../db.js";
import type { NormalizedMarket } from "../normalize/market.js";
import type { NormalizedTrade } from "../normalize/trade.js";

export async function upsertMarkets(markets: NormalizedMarket[]) {
  let affectedRows = 0;
  for (const market of markets) {
    const result = await pool.query(
      `
        INSERT INTO source_markets (
          id,
          platform,
          source_market_id,
          title,
          description,
          raw_category,
          canonical_category,
          status,
          open_time,
          close_time,
          url,
          metadata,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10::timestamptz, $11, $12::jsonb, NOW()
        )
        ON CONFLICT (id)
        DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          raw_category = EXCLUDED.raw_category,
          canonical_category = EXCLUDED.canonical_category,
          status = EXCLUDED.status,
          open_time = EXCLUDED.open_time,
          close_time = EXCLUDED.close_time,
          url = EXCLUDED.url,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `,
      [
        market.id,
        market.platform,
        market.sourceMarketId,
        market.title,
        market.description ?? null,
        market.rawCategory ?? null,
        market.canonicalCategory,
        market.status ?? null,
        market.openTime ?? null,
        market.closeTime ?? null,
        market.url ?? null,
        JSON.stringify(market.metadata ?? {}),
      ],
    );
    affectedRows += result.rowCount ?? 0;
  }

  return {
    attempted: markets.length,
    affected: affectedRows,
  };
}

export async function upsertTrades(trades: NormalizedTrade[]) {
  let insertedRows = 0;
  for (const trade of trades) {
    const result = await pool.query(
      `
        INSERT INTO raw_trades (
          id,
          platform,
          source_trade_id,
          market_id,
          trade_ts,
          price,
          size,
          volume_usd,
          side,
          outcome,
          metadata
        )
        SELECT
          $1, $2, $3, $4, $5::timestamptz, $6::numeric, $7::numeric, $8::numeric, $9, $10, $11::jsonb
        WHERE EXISTS (SELECT 1 FROM source_markets sm WHERE sm.id = $4)
        ON CONFLICT (id) DO NOTHING
      `,
      [
        trade.id,
        trade.platform,
        trade.sourceTradeId,
        trade.marketId,
        trade.tradeTs,
        trade.price ?? null,
        trade.size ?? null,
        trade.volumeUsd,
        trade.side ?? null,
        trade.outcome ?? null,
        JSON.stringify(trade.metadata ?? {}),
      ],
    );
    insertedRows += result.rowCount ?? 0;
  }

  return {
    attempted: trades.length,
    inserted: insertedRows,
  };
}
