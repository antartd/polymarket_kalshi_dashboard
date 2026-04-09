# Polymarket vs Kalshi Dashboard (MVP)

Local demo dashboard comparing aggregated trading volume between Polymarket and Kalshi.

## Stack

- `frontend`: React + Vite + TypeScript
- `backend`: Node.js + Express + PostgreSQL queries
- `ingestion`: Node.js worker (polling, fallback-ready skeleton)
- `postgres`: local PostgreSQL (schema initialized from `DATA_SCHEMA.sql`)

## Quick Start

1. Copy env template:

```bash
cp .env.example .env
```

2. Start all services:

```bash
docker compose up --build
```

3. Open:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:4000/api/health`

## Implemented so far

- Monorepo structure with `backend`, `ingestion`, `frontend`
- Docker Compose with Postgres + app services
- DB init via `postgres/init.sql`
- Backend API endpoints:
  - `GET /api/health`
  - `GET /api/analytics/volume`
  - `GET /api/analytics/category-share`
  - `GET /api/analytics/delta`
  - `GET /api/analytics/anomalies`
  - `GET /api/analytics/export.csv`
- Query validation for range/categories/platforms/threshold
- Stable empty-state behavior for all-categories-disabled
- Frontend dashboard page with:
  - range selector
  - platform/category filters
  - hero line chart
  - delta cards
  - category share pie chart
  - dark mode toggle (persisted in `localStorage`)
  - CSV export button
  - loading/error/empty states
- Ingestion worker skeleton with scheduled jobs:
  - market sync
  - trade sync
  - aggregate refresh
  - cleanup
  - Polymarket fallback path placeholder (`official -> graph fallback`)

## Notes

- Adapters currently return placeholder payloads; next step is wiring real API integrations for Polymarket and Kalshi.
- Aggregation refresh and retention are implemented and can run once normalized trades/markets are ingested.
