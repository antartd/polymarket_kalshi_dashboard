# Ingestion Plan

## Goal

Fetch quasi-realtime market and trade data from:

- Polymarket official API / CLOB API
- The Graph as fallback for Polymarket
- Kalshi official API

Then normalize and persist data into PostgreSQL.

## Strategy

## 1. General principles

- polling-based ingestion for MVP
- short interval, e.g. every 30-60 seconds
- one worker process is enough for the demo
- use idempotent upserts
- store recent raw data + maintain aggregate tables
- isolate source adapters from normalization logic

## 2. Source priority

## Polymarket
Primary:
- official Polymarket API / CLOB API

Fallback:
- The Graph

Rule:
- try official Polymarket source first
- if request fails or data is unavailable, fallback to The Graph
- log which source was used

## Kalshi
Primary:
- official Kalshi API

No third-party analytical source should be used as the primary data source for Kalshi.

## 3. Ingestion jobs

Split into logical jobs.

### A. Market sync job
Runs less frequently, for example every 5-15 minutes.

Responsibilities:
- fetch active/recent markets
- fetch market metadata
- update category mapping inputs
- upsert into `source_markets`

### B. Trade sync job
Runs every 30-60 seconds.

Responsibilities:
- fetch recent trades since last cursor/timestamp
- normalize trade records
- upsert into `raw_trades`
- update aggregate tables

### C. Aggregate refresh job
Runs after trade sync or as a small scheduled task.

Responsibilities:
- recompute affected `daily_volume`
- recompute `daily_volume_platform_total`
- recompute anomaly cache for affected recent windows

### D. Cleanup job
Runs daily.

Responsibilities:
- delete raw trades older than retention window
- keep aggregates
- vacuum/analyze optional if needed

## 4. Rational retention

For MVP:
- raw trades retention: 30 days
- daily aggregates: full history
- anomaly cache: full or recent as preferred

This is enough for demo value while keeping storage reasonable.

## 5. Normalization model

Normalize both sources into a common trade object:

```ts
type NormalizedTrade = {
  id: string;
  platform: 'polymarket' | 'kalshi';
  sourceTradeId: string;
  marketId: string;
  tradeTs: string;
  price?: string;
  size?: string;
  volumeUsd: string;
  side?: string;
  outcome?: string;
  metadata?: Record<string, unknown>;
}
```

Normalize both sources into a common market object:

```ts
type NormalizedMarket = {
  id: string;
  platform: 'polymarket' | 'kalshi';
  sourceMarketId: string;
  title: string;
  description?: string;
  rawCategory?: string;
  canonicalCategory: string;
  subcategory?: string;
  status?: string;
  openTime?: string;
  closeTime?: string;
  resolutionTime?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}
```

## 6. Category mapping

MVP uses manual mapping only.

Canonical values:
- sports
- crypto
- politics
- geopolitics
- finance
- culture
- tech_science
- other

Implementation rule:
- perform mapping in application code, not only in SQL
- keep mapping rules explicit and editable
- default unknown values to `other`

Recommended order:
1. explicit source category match
2. title/description keyword match
3. fallback to `other`

## 7. Aggregate update logic

The UI should query aggregate tables only.

Daily aggregate formula:
- sum `volume_usd` grouped by:
  - day
  - platform
  - canonical_category

Also maintain optional per-platform daily totals.

Incremental update approach:
- determine affected days from newly ingested trades
- recompute aggregates only for those affected days
- avoid full-table recalculation on every sync

## 8. Delta calculation support

Delta compares selected period to previous equivalent period.

API may compute it on request using aggregate tables.
No need to precompute all deltas in DB for MVP.

Example:
- selected range = last 30 days
- previous range = prior 30-day block

## 9. Anomaly detection support

Use z-score on daily platform totals.

MVP recommendation:
- calculate anomalies on daily platform totals, not raw trades
- optionally recalculate last 90 days after each update
- store result in `daily_volume_anomalies`

Basic idea:
1. fetch recent daily volumes per platform
2. compute mean and standard deviation
3. compute z-score per point
4. mark as anomaly when z-score >= threshold

Recommended threshold:
- 2.5 or 3.0

## 10. Idempotency rules

All ingestion must be idempotent.

Rules:
- use source trade ids when available
- use stable synthetic ids when source ids are missing
- upsert markets
- ignore duplicate trades
- never double-count aggregates

## 11. Failure handling

Rules:
- if Polymarket primary source fails, fallback to The Graph
- if both fail, do not stop Kalshi ingestion
- partial source failure must not corrupt aggregates
- record ingestion state and timestamps
- log source, cursor, duration, and error reason

## 12. Recommended module structure

```text
backend/
  src/
    ingestion/
      adapters/
        kalshi.ts
        polymarket.ts
        polymarket-graph-fallback.ts
      normalize/
        market.ts
        trade.ts
        category-mapper.ts
      jobs/
        sync-markets.ts
        sync-trades.ts
        refresh-aggregates.ts
        cleanup.ts
      state/
        cursor-store.ts
```

## 13. Rule for Codex implementation

Do not implement the dashboard as:
- direct frontend calls to external APIs
- static JSON snapshot files as source of truth

Implement it as:
- ingestion -> own DB -> aggregate queries -> own API -> frontend
