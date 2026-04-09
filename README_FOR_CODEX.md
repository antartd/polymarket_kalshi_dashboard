# Codex Instruction Bundle

This folder contains the project instructions for implementing a local MVP dashboard that compares Polymarket and Kalshi trading volume.

Included files:
- `ARCHITECTURE.md`
- `MVP_SPEC.md`
- `DATA_SCHEMA.sql`
- `INGESTION_PLAN.md`
- `API_SPEC.md`
- `FRONTEND_SPEC.md`
- `TASKS.md`

## Implementation priorities

This is a demo-first project, but it must be implemented with a real architecture:

- React + Vite frontend
- Node.js backend/API
- Node.js ingestion worker
- PostgreSQL
- local docker-compose setup
- no authentication
- public dashboard

## Critical rules

1. Do not use Dune or third-party dashboards as the application's data layer
2. For Polymarket:
   - use official API/CLOB API first
   - use The Graph only as fallback
3. For Kalshi:
   - use official Kalshi API
4. Frontend must query only the local backend API
5. Use aggregate tables for dashboard queries
6. Manual category mapping is required for MVP
7. Delta compares selected period vs previous equivalent period
8. Anomalies use z-score
9. CSV export must export aggregate data for the current filtered view
10. Implement clear loading, empty, and error states

## Suggested first implementation order

1. PostgreSQL schema
2. source adapters
3. ingestion jobs
4. aggregate refresh logic
5. backend analytics endpoints
6. React dashboard UI
7. docker-compose and local run flow
