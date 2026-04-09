# Architecture

## Goal

Build a local public dashboard that compares historical trading volume for two prediction market platforms:

- Polymarket
- Kalshi

The dashboard must support:

- combined hero chart with both platforms on one time-series
- category filtering
- market share pie chart by category
- period-over-period delta
- anomaly peak detection using z-score
- dark mode
- CSV export
- loading and error states
- responsive UI

The project is an MVP/demo, but the architecture should be clean and extensible.

## Core decision summary

### Data sources
- **Polymarket**
  - primary source: official Polymarket API / CLOB API
  - fallback source: The Graph
- **Kalshi**
  - source: official Kalshi API

### Update model
- quasi-realtime
- periodic ingestion with short polling interval
- use REST polling for MVP
- if stable websocket support is available, it may be added later without changing the data model

### Database
- PostgreSQL
- reason: simpler and faster to ship for MVP/demo
- raw trades kept only for a rational recent window
- aggregated data kept for full available history

### Frontend
- React + Vite

### Deployment
- local only
- docker-compose based

### Auth
- no authentication
- public dashboard

## Architecture overview

```text
Polymarket API/CLOB (primary) ----\
                                   \
                                    -> ingestion service -> normalization -> PostgreSQL -> API -> React/Vite dashboard
                                   /
The Graph (fallback for PM) -------/

Kalshi API ------------------------/
```

## Components

## 1. Ingestion service

A Node.js service that periodically fetches new data from both sources.

Responsibilities:
- fetch recent markets and trade data
- retry on transient failures
- use fallback source for Polymarket when primary source is unavailable
- deduplicate trades/records
- normalize platform-specific payloads
- upsert raw data
- update aggregates

Recommended interval:
- every 30-60 seconds for latest data refresh
- for heavy backfill, use separate batch jobs

## 2. Normalization layer

Unifies records from both platforms into one internal schema.

Responsibilities:
- unify timestamps
- unify volume fields into `volume_usd`
- map source-specific categories/tags to one canonical category set
- normalize market identifiers
- ensure data can be compared across platforms

Canonical categories:
- sports
- crypto
- politics
- geopolitics
- finance
- culture
- tech_science
- other

Manual mapping is required for MVP.

## 3. Storage layer

PostgreSQL stores:
- source markets
- recent raw trades
- daily aggregates
- optional hourly aggregates
- anomaly calculation inputs or cached anomaly results

Design rule:
- UI should read from aggregate tables, not from raw trades

Reason:
- predictable performance
- simpler API queries
- easier CSV export
- cleaner frontend logic

Retention rule for MVP:
- raw trades: keep 30-90 days
- aggregated daily volume: keep full history
- aggregated hourly volume: optional, shorter retention

## 4. API layer

A Node.js backend exposes analytics endpoints for the frontend.

Responsibilities:
- serve aggregated volume series
- serve delta values
- serve category share data
- serve anomalies
- serve CSV export
- validate filters and date ranges
- return structured errors

The API must not directly proxy upstream platform APIs to the UI.

## 5. Frontend

React + Vite application.

Responsibilities:
- render hero chart
- render category filters
- render period selectors
- render pie chart
- render delta cards
- render anomaly markers
- render empty/loading/error states
- support dark mode
- support CSV export

## Data flow

### Historical flow
1. fetch historical data from both platforms
2. normalize
3. store raw data
4. compute daily aggregates
5. expose aggregated endpoints
6. render dashboard

### Incremental flow
1. fetch new markets/trades since last cursor/time
2. normalize and deduplicate
3. upsert
4. update affected aggregates only
5. frontend refetches or polls API

## Why this architecture

This architecture is intentionally different from a snapshot demo.

It avoids:
- frontend reading directly from external APIs
- one-off JSON cache files as source of truth
- hard dependency on third-party dashboards
- inability to compare both platforms consistently

It supports:
- platform comparison
- category-based filtering
- CSV export
- anomaly analytics
- extensibility beyond the MVP

## MVP constraints

This is a demo, so keep it rational:

- Use PostgreSQL, not ClickHouse
- Use daily aggregates for the main chart
- Use raw trade retention limits
- Use manual category mapping
- Use polling first, websocket later if needed
- Run everything locally through docker-compose

## Recommended services

- `frontend` — React + Vite
- `backend` — Node.js API
- `ingestion` — Node.js worker
- `postgres` — PostgreSQL
- optional `nginx` — local reverse proxy only if needed

## Non-goals for MVP

- user accounts
- watchlists
- alerting
- distributed ingestion
- multi-tenant architecture
- production deployment
- advanced RBAC
- heavy observability stack

## Design rule

External APIs are **inputs**, not the application's data layer.

The application's data layer is:

`source APIs -> normalization -> own DB -> aggregates -> own API -> UI`
