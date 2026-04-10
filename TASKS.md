# Implementation Tasks

## Phase 1 — Project setup

- [x] Initialize monorepo or clear project structure for:
  - frontend
  - backend
  - ingestion
- [x] Add docker-compose for local development
- [x] Add PostgreSQL service
- [x] Add environment variable templates
- [x] Add README with local run steps

## Phase 2 — Database

- [x] Create PostgreSQL schema from `DATA_SCHEMA.sql`
- [x] Add migrations or initialization flow
- [x] Add indexes

## Phase 3 — Source adapters

### Polymarket
- [x] Implement primary Polymarket adapter using official API/CLOB API
- [x] Implement fallback adapter using The Graph
- [x] Add source selection/fallback logic
- [x] Normalize markets
- [x] Normalize trades

### Kalshi
- [x] Implement Kalshi API adapter
- [x] Normalize markets
- [x] Normalize trades

## Phase 4 — Ingestion pipeline

- [x] Implement market sync job
- [x] Implement trade sync job
- [x] Implement ingestion_state persistence
- [x] Implement idempotent upserts
- [x] Implement retention cleanup job
- [x] Add logging for source, cursor, and errors
- [x] Add startup auto-backfill to maximum available depth
- [x] Ensure partial source failures do not stop the whole ingestion cycle
- [x] Fix Kalshi trade cursor progression to avoid duplicate-first-page loops
- [x] Add Kalshi historical backfill command and validation flow
- [x] Add auto-backfill Kalshi coverage guard (re-run when coverage is too low)

## Phase 5 — Category mapping

- [x] Implement manual category mapping service
- [x] Map source-specific values into canonical categories:
  - sports
  - crypto
  - politics
  - geopolitics
  - finance
  - culture
  - tech_science
  - other
- [x] Default unmapped values to `other`

## Phase 6 — Aggregations

- [x] Build daily aggregate refresh logic
- [x] Maintain `daily_volume`
- [x] Maintain `daily_volume_platform_total`
- [x] Add anomaly calculation using z-score
- [x] Store anomaly results or calculate on request
- [x] Add hourly aggregates (`hourly_volume`)

## Phase 7 — Backend API

- [x] Implement `GET /api/health`
- [x] Implement `GET /api/analytics/volume`
- [x] Implement `GET /api/analytics/category-share`
- [x] Implement `GET /api/analytics/delta`
- [x] Implement `GET /api/analytics/anomalies`
- [x] Implement `GET /api/analytics/export.csv`
- [x] Implement `GET /api/analytics/last-updated`
- [x] Implement `GET /api/analytics/stream` (SSE)
- [x] Add query validation
- [x] Add structured error handling
- [x] Add short-lived response cache for hot analytics endpoints
- [x] Add optional Dune fallback for missing early historical window

## Phase 8 — Frontend dashboard

- [x] Create dashboard page layout
- [x] Create header with title, theme toggle, export button
- [x] Create range selector
- [x] Create category filters
- [x] Create hero line chart with both platforms
- [x] Integrate anomalies/delta data into shared frontend data model
- [x] Implement category comparison visualization (volume + share metrics)
- [x] Build modern chart-centric layout replacing legacy pie/delta blocks
- [x] Replace layout with modern hero + category-comparison view
- [x] Add source switch (`Dune Snapshot` / `Live API`)
- [x] Add chart type switch (line/bar) and series visibility toggles
- [x] Add loading states
- [x] Add error states
- [x] Add empty states
- [x] Add responsive behavior
- [x] Add dark theme persistence
- [x] Improve dark-theme text contrast and chart readability
- [x] Add full RU/EN localization with persisted language switch
- [x] Add live refresh via SSE without page/scroll reset
- [x] Refresh ranges from requested period window (`now - period`)

## Phase 9 — QA / polish

- [x] Verify all ranges: 7d / 30d / 90d / all
- [x] Verify category filters affect all widgets
- [x] Verify all-categories-disabled state
- [x] Verify delta uses previous equivalent period
- [x] Verify analytics endpoints for anomalies/delta stay stable under active filters
- [x] Verify CSV export matches active filters
- [x] Verify dashboard works locally via docker-compose
- [x] Verify dark mode and mobile layout
- [x] Verify live updates do not trigger full-page loading reset

## Phase 10 — Nice-to-have after MVP

- [x] Add hourly aggregates
- [x] Add last updated indicator
- [x] Add background/manual backfill command
- [x] Add live stream updates (SSE)
- [x] Add cache layer if needed

## Phase 11 — Backend optimization plan

### 11.1 Quick wins (stability + immediate latency impact)
- [ ] Add unified `request_id` for every API request and include it in logs/responses
- [ ] Replace raw `console.*` with structured logger (level, endpoint, duration_ms, request_id, source)
- [ ] Add per-endpoint timing metrics (p50/p95/p99, error rate) and slow-query threshold logging
- [ ] Add bounded in-memory cache policy (max keys / memory guard / eviction stats)
- [ ] Prevent duplicate live-warm jobs for the same cache key (singleflight lock by key)
- [ ] Add startup check for Dune snapshot file availability and explicit status flag in `/api/health`

### 11.2 Query and data-path optimization
- [ ] Split `analytics.ts` into focused modules: `volume`, `category-share`, `delta`, `anomalies`, `metadata`
- [ ] Introduce shared pre-aggregation fetch helper to avoid repeated heavy scans per endpoint
- [ ] Eliminate repeated range/category/platform scans between `volume/category-share/delta/anomalies`
- [ ] Add optional batched endpoint (`/api/analytics/dashboard`) to fetch all widgets in one request
- [ ] Add explicit DB index audit for active WHERE/GROUP BY patterns used by analytics queries
- [ ] Add materialized aggregation refresh strategy for expensive windows (30d/90d/all) with TTL invalidation

### 11.3 Cache architecture hardening
- [ ] Add L2 cache (Redis) behind current in-memory cache for multi-instance consistency
- [ ] Implement stale-while-revalidate strategy for hot analytics endpoints
- [ ] Add source-aware cache namespaces (`source=dune|live`) with independent TTL policies
- [ ] Cache Dune snapshot parse result in memory with file mtime-based revalidation
- [ ] Add explicit cache invalidation hooks after ingestion aggregate refresh

### 11.4 SSE and live-update efficiency
- [ ] Replace per-connection polling with shared publisher loop (single DB read fan-out)
- [ ] Add heartbeat + backoff policy for SSE clients and connection count guardrails
- [ ] Add change-detection gate so SSE emits only on real data freshness changes
- [ ] Add lightweight `/api/analytics/stream/status` for operational checks

### 11.5 Reliability and failure isolation
- [ ] Add circuit-breaker behavior for Dune read path (cooldown after repeated failures)
- [x] Add graceful fallback matrix (`dune -> live`, `live -> last good cache`) with explicit response metadata
- [x] Add retry policy with jitter for external-provider calls and bounded timeout budget
- [ ] Add background warmup scheduler (instead of request-triggered warming only)
- [x] Add worker/backend contract validation for snapshot schema versioning

### 11.6 Security and operational controls
- [ ] Add request rate-limiting for analytics endpoints
- [ ] Add strict input limits (max categories/platforms/query size) and safer CSV export bounds
- [x] Add CORS config validation at startup with clear warning for risky origins
- [ ] Add dependency audit + pinned base image patch cadence for backend container

### 11.7 Testing and performance verification
- [ ] Add integration tests for `source=dune|live` parity on same filter set
- [ ] Add regression tests for fallback behavior when snapshot file is missing/stale
- [ ] Add load-test сценарии for `/volume`, `/category-share`, `/delta`, `/anomalies`, SSE
- [ ] Define SLO targets (e.g. p95 < 300ms for cached, p95 < 1.5s uncached) and acceptance checklist
- [ ] Run before/after benchmark and document wins in `README` / architecture docs
