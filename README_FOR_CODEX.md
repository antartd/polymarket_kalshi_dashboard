# Codex Instruction Bundle

Репозиторий содержит реализацию локального dashboard `Polymarket vs Kalshi`.

## Документы

- `README.md`
- `ARCHITECTURE.md`
- `API_SPEC.md`
- `FRONTEND_SPEC.md`
- `INGESTION_PLAN.md`
- `MVP_SPEC.md`
- `TASKS.md`
- `DATA_SCHEMA.sql`

## Runtime services

- `frontend`
- `backend`
- `ingestion`
- `worker` (Dune embedded SQL snapshot refresher)
- `postgres`

## Current key rules

1. Official APIs — primary ingestion path.
2. Polymarket fallback: The Graph.
3. Kalshi: official API only.
4. Frontend работает только через local backend `/api`.
5. Backend source modes:
   - `dune` (default)
   - `live`
6. Fallback matrix:
   - `dune -> live`
   - `live -> last good cache`
7. Dune используется через embedded SQL (без `query_id`), snapshot-файл обновляет `worker`.
8. Analytics API читает агрегаты/снимок, не upstream payloads.
9. UI: mobile responsive, dark/light, RU/EN.

## Implementation order (already applied)

1. DB schema + init
2. adapters + normalization
3. ingestion jobs + auto-backfill
4. aggregates refresh
5. backend analytics + SSE + cache
6. Dune snapshot worker
7. frontend dashboard + i18n + responsive layout
8. docker-compose local runtime

