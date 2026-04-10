# Architecture

## Goal

Собрать локальный аналитический dashboard для сравнения объёмов торгов:

- Polymarket
- Kalshi

с двумя режимами источника данных для UI:

- `dune` (snapshot cache, по умолчанию)
- `live` (актуальные данные из локальных агрегатов)

## High-level

```text
Polymarket APIs (gamma/data) ----\
                                   \
Kalshi API -------------------------> ingestion -> PostgreSQL aggregates -> backend /api -> frontend
                                   /
Polymarket The Graph fallback -----/

Dune API (embedded SQL) -> worker -> backend/data/dashboard-cache.json -> backend (source=dune)
```

## Components

## 1) Ingestion (`ingestion`)

Responsibilities:

- `sync-markets`: upsert markets по двум платформам
- `sync-trades`: incremental ingestion трейдов
- Polymarket fallback на The Graph при ошибке primary
- `refresh-aggregates`: пересчёт `daily_volume`, `daily_volume_platform_total`, `hourly_volume`
- `cleanup`: retention сырого трейд-слоя
- `auto-backfill`: добор истории на старте (с coverage-check для Kalshi)

Key behavior:

- idempotent upsert
- cursor/state в `ingestion_state`
- Kalshi trade sync поддерживает pagination cursor между циклами
- partial failure в одном источнике не останавливает весь цикл

## 2) Dune snapshot worker (`worker`)

Responsibilities:

- выполняет embedded SQL через Dune API (`/sql/execute`)
- polling статуса execution и сбор paginated results
- строит единый snapshot JSON c schema version
- записывает кэш-файл (`dashboard-cache.json`) для backend
- работает в цикле с hourly refresh

Important:

- используется `mode=embedded_sql`
- `queryIds=null`
- retry + timeout + jitter

## 3) Storage (PostgreSQL)

Основные таблицы:

- `source_markets`
- `raw_trades`
- `daily_volume`
- `daily_volume_platform_total`
- `hourly_volume`
- `ingestion_state`

Rule:

- API/UI работает с агрегатами; `raw_trades` — operational слой.

## 4) Backend API (`backend`)

Responsibilities:

- query validation (`zod`)
- analytics endpoints
- short TTL in-memory cache
- source selection (`dune|live`)
- fallback matrix:
  - `dune -> live`
  - `live -> last good cache`
- SSE stream для live refresh signal
- CORS-risk validation на старте

## 5) Frontend (`frontend`)

Responsibilities:

- фильтры range/source/category
- hero volume chart (line/bar)
- category comparison (desktop table + mobile cards)
- CSV export
- dark/light theme
- RU/EN switch
- SSE-based live refresh без scroll reset

## Data flow

## Startup

1. `worker` начинает refresh snapshot loop
2. `ingestion` выполняет `auto-backfill`, затем `market-sync` и `trade-sync`
3. `refresh-aggregates`
4. `backend` отдаёт API с source metadata
5. `frontend` рендерит `source=dune` по умолчанию и может переключиться на `live`

## Request path (`/api/analytics/*`)

1. parse filters (`range`, `source`, `categories`, `platforms`)
2. route-level short cache
3. source resolution:
   - `source=dune`: читаем snapshot file
   - если snapshot пуст/недоступен -> fallback на `live`
   - `source=live`: читаем local aggregates
   - если live пуст, возвращаем `last good live cache`
4. ответ включает `snapshot` и `source_meta`

## Finite ranges

Для `7d/30d/90d`:

- окно строится от текущего UTC дня
- backend выполняет day-padding до нулей

## Design principles

- Frontend не ходит во внешние API.
- Локальный backend — единый data contract для UI.
- Official APIs остаются основным ingestion path.
- Dune snapshot — cached source для быстрых ответов и старой истории.
- Документированная деградация важнее, чем "silent fail".
