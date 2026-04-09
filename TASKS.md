# Implementation Tasks

## Phase 1 — Project setup

- [ ] Initialize monorepo or clear project structure for:
  - frontend
  - backend
  - ingestion
- [ ] Add docker-compose for local development
- [ ] Add PostgreSQL service
- [ ] Add environment variable templates
- [ ] Add README with local run steps

## Phase 2 — Database

- [ ] Create PostgreSQL schema from `DATA_SCHEMA.sql`
- [ ] Add migrations or initialization flow
- [ ] Add indexes
- [ ] Add seed support for manual category mapping if needed

## Phase 3 — Source adapters

### Polymarket
- [ ] Implement primary Polymarket adapter using official API/CLOB API
- [ ] Implement fallback adapter using The Graph
- [ ] Add source selection/fallback logic
- [ ] Normalize markets
- [ ] Normalize trades

### Kalshi
- [ ] Implement Kalshi API adapter
- [ ] Normalize markets
- [ ] Normalize trades

## Phase 4 — Ingestion pipeline

- [ ] Implement market sync job
- [ ] Implement trade sync job
- [ ] Implement ingestion_state persistence
- [ ] Implement idempotent upserts
- [ ] Implement retention cleanup job
- [ ] Add logging for source, cursor, and errors

## Phase 5 — Category mapping

- [ ] Implement manual category mapping service
- [ ] Map source-specific values into canonical categories:
  - sports
  - crypto
  - politics
  - geopolitics
  - finance
  - culture
  - tech_science
  - other
- [ ] Default unmapped values to `other`

## Phase 6 — Aggregations

- [ ] Build daily aggregate refresh logic
- [ ] Maintain `daily_volume`
- [ ] Maintain `daily_volume_platform_total`
- [ ] Add anomaly calculation using z-score
- [ ] Store anomaly results or calculate on request

## Phase 7 — Backend API

- [ ] Implement `GET /api/health`
- [ ] Implement `GET /api/analytics/volume`
- [ ] Implement `GET /api/analytics/category-share`
- [ ] Implement `GET /api/analytics/delta`
- [ ] Implement `GET /api/analytics/anomalies`
- [ ] Implement `GET /api/analytics/export.csv`
- [ ] Add query validation
- [ ] Add structured error handling

## Phase 8 — Frontend dashboard

- [ ] Create dashboard page layout
- [ ] Create header with title, theme toggle, export button
- [ ] Create range selector
- [ ] Create category filters
- [ ] Create hero line chart with both platforms
- [ ] Add anomaly markers to hero chart
- [ ] Create delta cards
- [ ] Create category share pie chart
- [ ] Add loading states
- [ ] Add error states
- [ ] Add empty states
- [ ] Add responsive behavior
- [ ] Add dark theme persistence

## Phase 9 — QA / polish

- [ ] Verify all ranges: 7d / 30d / 90d / all
- [ ] Verify category filters affect all widgets
- [ ] Verify all-categories-disabled state
- [ ] Verify delta uses previous equivalent period
- [ ] Verify anomaly markers are stable
- [ ] Verify CSV export matches active filters
- [ ] Verify dashboard works locally via docker-compose
- [ ] Verify dark mode and mobile layout

## Phase 10 — Nice-to-have after MVP

- [ ] Add hourly aggregates
- [ ] Add last updated indicator
- [ ] Add background backfill command
- [ ] Add websocket updates
- [ ] Add cache layer if needed
