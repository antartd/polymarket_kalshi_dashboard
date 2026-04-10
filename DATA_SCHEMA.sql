-- PostgreSQL schema for the MVP/demo dashboard

-- Canonical category values expected by application logic:
-- sports
-- crypto
-- politics
-- geopolitics
-- finance
-- culture
-- tech_science
-- other

CREATE TABLE IF NOT EXISTS source_markets (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL CHECK (platform IN ('polymarket', 'kalshi')),
    source_market_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    raw_category TEXT,
    canonical_category TEXT NOT NULL,
    subcategory TEXT,
    status TEXT,
    open_time TIMESTAMPTZ,
    close_time TIMESTAMPTZ,
    resolution_time TIMESTAMPTZ,
    url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_source_markets_platform_source_id
    ON source_markets(platform, source_market_id);

CREATE INDEX IF NOT EXISTS idx_source_markets_category
    ON source_markets(canonical_category);

CREATE TABLE IF NOT EXISTS raw_trades (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL CHECK (platform IN ('polymarket', 'kalshi')),
    source_trade_id TEXT NOT NULL,
    market_id TEXT NOT NULL REFERENCES source_markets(id) ON DELETE CASCADE,
    trade_ts TIMESTAMPTZ NOT NULL,
    price NUMERIC(20,10),
    size NUMERIC(20,10),
    volume_usd NUMERIC(20,10) NOT NULL,
    side TEXT,
    outcome TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_trades_platform_source_trade_id
    ON raw_trades(platform, source_trade_id);

CREATE INDEX IF NOT EXISTS idx_raw_trades_trade_ts
    ON raw_trades(trade_ts);

CREATE INDEX IF NOT EXISTS idx_raw_trades_market_id
    ON raw_trades(market_id);

CREATE TABLE IF NOT EXISTS daily_volume (
    day DATE NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('polymarket', 'kalshi')),
    canonical_category TEXT NOT NULL,
    volume_usd NUMERIC(20,10) NOT NULL DEFAULT 0,
    trade_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (day, platform, canonical_category)
);

CREATE INDEX IF NOT EXISTS idx_daily_volume_day
    ON daily_volume(day);

CREATE INDEX IF NOT EXISTS idx_daily_volume_platform_day
    ON daily_volume(platform, day);

CREATE INDEX IF NOT EXISTS idx_daily_volume_category_day
    ON daily_volume(canonical_category, day);

CREATE TABLE IF NOT EXISTS daily_volume_platform_total (
    day DATE NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('polymarket', 'kalshi')),
    volume_usd NUMERIC(20,10) NOT NULL DEFAULT 0,
    trade_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (day, platform)
);

CREATE TABLE IF NOT EXISTS hourly_volume (
    hour_ts TIMESTAMPTZ NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('polymarket', 'kalshi')),
    canonical_category TEXT NOT NULL,
    volume_usd NUMERIC(20,10) NOT NULL DEFAULT 0,
    trade_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (hour_ts, platform, canonical_category)
);

CREATE INDEX IF NOT EXISTS idx_hourly_volume_platform_hour
    ON hourly_volume(platform, hour_ts);

CREATE TABLE IF NOT EXISTS daily_volume_anomalies (
    day DATE NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('polymarket', 'kalshi')),
    z_score NUMERIC(12,6) NOT NULL,
    threshold NUMERIC(12,6) NOT NULL,
    is_anomaly BOOLEAN NOT NULL DEFAULT FALSE,
    volume_usd NUMERIC(20,10) NOT NULL,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (day, platform)
);

CREATE TABLE IF NOT EXISTS ingestion_state (
    source_name TEXT PRIMARY KEY,
    cursor_value TEXT,
    last_success_at TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS category_mapping_rules (
    id BIGSERIAL PRIMARY KEY,
    platform TEXT NOT NULL CHECK (platform IN ('polymarket', 'kalshi')),
    match_type TEXT NOT NULL CHECK (match_type IN ('equals', 'contains', 'regex')),
    source_field TEXT NOT NULL CHECK (source_field IN ('raw_category', 'title', 'description', 'tag')),
    pattern TEXT NOT NULL,
    canonical_category TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
