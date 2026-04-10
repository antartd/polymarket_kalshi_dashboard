# Ingestion Plan (Current)

## Goal

Собирать near-realtime данные рынков и сделок из официальных API Polymarket/Kalshi, нормализовать, хранить в PostgreSQL и поддерживать агрегаты для backend analytics.

## Sources

## Polymarket

Primary:

- `POLYMARKET_GAMMA_BASE` (markets)
- `POLYMARKET_DATA_BASE` (trades)

Fallback:

- `POLYMARKET_GRAPH_URL` (The Graph)

Rule:

1. primary first
2. при ошибке primary — fallback
3. логируем источник и результат

## Kalshi

Primary:

- `KALSHI_API_BASE` (official Trade API v2)

Rule:

- только официальный API
- incremental sync по cursor/time-window

## Runtime model

- polling worker (`INGESTION_POLL_SECONDS`, default 60)
- startup `auto-backfill`
- periodic `market-sync` + `trade-sync`
- periodic `cleanup`

## Startup sequence

1. DB connect
2. `auto-backfill`
3. `market-sync`
4. `trade-sync`
5. `refresh-aggregates`
6. schedule loops

## Implemented jobs

## 1) `sync-markets`

- fetch markets per platform
- normalize
- idempotent upsert в `source_markets`

## 2) `sync-trades`

- incremental fetch трейдов
- normalize
- idempotent upsert в `raw_trades`
- update state в `ingestion_state`
- Kalshi поддерживает pagination cursor continuation между циклами

## 3) `refresh-aggregates`

Пересчёт:

- `daily_volume`
- `daily_volume_platform_total`
- `hourly_volume`

## 4) `cleanup`

- удаление старых `raw_trades` по retention policy

## 5) `auto-backfill`

- добор истории на старте
- idempotent
- поддерживает `AUTO_BACKFILL_*` tuning
- включает coverage logic для Kalshi (может повторно запускаться при низком покрытии)

## Normalization

## `NormalizedMarket`

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
};
```

## `NormalizedTrade`

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
};
```

## Canonical categories

- sports
- crypto
- politics
- geopolitics
- finance
- culture
- tech_science
- other

Unknown/missed mapping -> `other`.

## Reliability

- per-source failure isolation
- partial failure не останавливает весь цикл
- cursor/state persistence
- safe retries через следующий polling cycle

## Data contract for backend

- backend читает агрегаты, не `raw_trades`
- finite ranges строятся от текущего UTC дня
- snapshot/live source resolution выполняется в backend (не в ingestion)

