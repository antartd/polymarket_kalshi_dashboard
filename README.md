# Polymarket vs Kalshi Dashboard

Локальный аналитический дашборд для сравнения объёмов торгов между **Polymarket** и **Kalshi**.
<img width="1822" height="1180" alt="Снимок экрана 2026-04-10 в 03 51 33" src="https://github.com/user-attachments/assets/12b4e2b2-5462-4528-b0bb-f1b54d681e9c" />
<img width="1822" height="1180" alt="Снимок экрана 2026-04-10 в 03 51 50" src="https://github.com/user-attachments/assets/f5890087-ea41-4e5f-b261-5d999fa9fdd5" />
<img width="1822" height="1180" alt="Снимок экрана 2026-04-10 в 03 52 01" src="https://github.com/user-attachments/assets/cff69d1d-308a-4f9b-8bff-a878dabd3797" />
<img width="1822" height="1180" alt="Снимок экрана 2026-04-10 в 03 51 09" src="https://github.com/user-attachments/assets/cb63ba82-62c4-4ec6-839d-4dcb781b792d" />

Текущая схема:

`official APIs + Dune snapshot worker -> ingestion -> PostgreSQL -> backend API -> frontend`

## Что реализовано

- Monorepo c сервисами:
  - `frontend` (React + Vite + TypeScript + Recharts)
  - `backend` (Node.js + Express + PostgreSQL)
  - `ingestion` (Node.js polling worker)
  - `worker` (Dune embedded SQL snapshot refresher)
- PostgreSQL схема/инициализация: `postgres/init.sql`, `DATA_SCHEMA.sql`
- Реальные source adapters:
  - Polymarket: `gamma-api`, `data-api`
  - Polymarket fallback: The Graph
  - Kalshi: official Trade API v2
- Ingestion pipeline:
  - `sync-markets`
  - `sync-trades`
  - `refresh-aggregates` (`daily_volume`, `daily_volume_platform_total`, `hourly_volume`)
  - `cleanup`
  - startup `auto-backfill`
- Backend analytics API:
  - `GET /api/analytics/volume`
  - `GET /api/analytics/category-share`
  - `GET /api/analytics/delta`
  - `GET /api/analytics/anomalies`
  - `GET /api/analytics/export.csv`
  - `GET /api/analytics/last-updated`
  - `GET /api/analytics/stream` (SSE)
- Source selection и fallback matrix:
  - `source=dune` по умолчанию
  - `dune -> live` если snapshot недоступен/пуст
  - `live -> last good cache` при пустом live-ответе
- Frontend:
  - диапазоны `7d/30d/90d/all`
  - source switch (`Dune Snapshot` / `Live API`)
  - category filters
  - hero chart (line/bar switch, platform toggles, rich tooltip)
  - category comparison (desktop table + mobile card layout)
  - CSV export
  - light/dark mode
  - RU/EN language switch
  - live updates без сброса скролла/страницы

## Быстрый старт

1. Скопировать env:

```bash
cp .env.example .env
```

2. Запустить проект:

```bash
docker compose up --build
```

3. Открыть:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:4000/api/health`

## Ключевые env

### Core

- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT`
- `BACKEND_PORT`
- `CORS_ORIGIN`

### Ingestion

- `INGESTION_POLL_SECONDS`
- `POLYMARKET_GAMMA_BASE`
- `POLYMARKET_DATA_BASE`
- `POLYMARKET_GRAPH_URL`
- `KALSHI_API_BASE`
- `AUTO_BACKFILL_*` параметры

### Dune worker/backend snapshot

- `DUNE_API_KEY`
- `DUNE_BASE_URL` (default: `https://api.dune.com/api/v1`)
- `DUNE_PERFORMANCE`
- `DUNE_SNAPSHOT_FILE`
- `DUNE_WORKER_OUTPUT_FILE`
- `DUNE_*` polling/retry/timeout vars

## Команды

- Запуск: `docker compose up --build`
- Остановка: `docker compose down`
- Typecheck всех workspaces: `npm run typecheck`
- Ручной backfill ingestion:

```bash
npm run backfill --workspace ingestion
```

- Исторический backfill Kalshi:

```bash
npm run backfill:kalshi-history --workspace ingestion
```

- Одноразовый refresh Dune snapshot:

```bash
npm run refresh:dune-cache
```

## Принципы данных

- Frontend работает только через local backend `/api`.
- Источник истины для UI — backend responses + DB/snapshot.
- Для finite ranges (`7d/30d/90d`) backend строит окно от `today - range + 1` и day-padding до нулей.
- Dune snapshot используется как fast cached source; live остаётся operational источником и прогревается в фоне.
