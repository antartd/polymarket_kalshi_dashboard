import { pool } from "../db.js";

export async function runRefreshAggregatesJob() {
  await pool.query(
    `
      INSERT INTO daily_volume (day, platform, canonical_category, volume_usd, trade_count, updated_at)
      SELECT
        DATE(rt.trade_ts) AS day,
        rt.platform,
        sm.canonical_category,
        SUM(rt.volume_usd) AS volume_usd,
        COUNT(*)::int AS trade_count,
        NOW()
      FROM raw_trades rt
      INNER JOIN source_markets sm ON sm.id = rt.market_id
      WHERE rt.trade_ts >= NOW() - INTERVAL '90 days'
      GROUP BY DATE(rt.trade_ts), rt.platform, sm.canonical_category
      ON CONFLICT (day, platform, canonical_category)
      DO UPDATE SET
        volume_usd = EXCLUDED.volume_usd,
        trade_count = EXCLUDED.trade_count,
        updated_at = NOW()
    `,
  );

  await pool.query(
    `
      INSERT INTO daily_volume_platform_total (day, platform, volume_usd, trade_count, updated_at)
      SELECT
        day,
        platform,
        SUM(volume_usd) AS volume_usd,
        SUM(trade_count)::int AS trade_count,
        NOW()
      FROM daily_volume
      GROUP BY day, platform
      ON CONFLICT (day, platform)
      DO UPDATE SET
        volume_usd = EXCLUDED.volume_usd,
        trade_count = EXCLUDED.trade_count,
        updated_at = NOW()
    `,
  );
}
