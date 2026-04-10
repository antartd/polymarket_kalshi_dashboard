import { pool } from "../db.js";

export async function runRefreshAggregatesJob() {
  await pool.query(
    `
      CREATE TABLE IF NOT EXISTS hourly_volume (
        hour_ts TIMESTAMPTZ NOT NULL,
        platform TEXT NOT NULL CHECK (platform IN ('polymarket', 'kalshi')),
        canonical_category TEXT NOT NULL,
        volume_usd NUMERIC(20,10) NOT NULL DEFAULT 0,
        trade_count INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (hour_ts, platform, canonical_category)
      )
    `,
  );

  await pool.query(
    `
      CREATE INDEX IF NOT EXISTS idx_hourly_volume_platform_hour
        ON hourly_volume(platform, hour_ts)
    `,
  );

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

  await pool.query(
    `
      INSERT INTO hourly_volume (hour_ts, platform, canonical_category, volume_usd, trade_count, updated_at)
      SELECT
        DATE_TRUNC('hour', rt.trade_ts) AS hour_ts,
        rt.platform,
        sm.canonical_category,
        SUM(rt.volume_usd) AS volume_usd,
        COUNT(*)::int AS trade_count,
        NOW()
      FROM raw_trades rt
      INNER JOIN source_markets sm ON sm.id = rt.market_id
      WHERE rt.trade_ts >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('hour', rt.trade_ts), rt.platform, sm.canonical_category
      ON CONFLICT (hour_ts, platform, canonical_category)
      DO UPDATE SET
        volume_usd = EXCLUDED.volume_usd,
        trade_count = EXCLUDED.trade_count,
        updated_at = NOW()
    `,
  );
}
