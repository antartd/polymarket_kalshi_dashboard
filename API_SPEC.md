# API Specification

## Overview

Backend обслуживает analytics для локального dashboard. Frontend не должен обращаться к upstream APIs напрямую.

Base path: `/api`

## Common query params

- `range=7d|30d|90d|all` (default `30d`)
- `source=dune|live` (default `dune`)
- `categories=sports,crypto,...` (optional; default all)
- `platforms=polymarket,kalshi` (optional; default all)
- `threshold` — только для anomalies (`0..10`, optional)

## Validation

- invalid `range/source/category/platform/threshold` -> `400`
- empty `categories` разрешено и возвращает stable empty payload + message

## Range semantics

- finite ranges (`7d/30d/90d`) строятся как `today_utc - (days-1) .. today_utc`
- для finite ranges `volume` возвращается с day-padding (пропуски -> `0`)
- `all` возвращает все доступные данные источника

## Source semantics

Ответы analytics-эндпоинтов включают:

- `source` — requested source
- `source_meta`:
  - `requested_source`
  - `served_source`
  - `fallback_reason`: `none | dune_snapshot_missing | live_empty_use_last_good_cache`
- `snapshot`:
  - для `dune`: `generated_at`, `next_refresh_at`, `refresh_interval_seconds`
  - для `live`: значения `null`

## 1) GET /api/analytics/volume

Hero chart series по платформам.

### Response shape

```json
{
  "range": "30d",
  "source": "dune",
  "source_meta": {
    "requested_source": "dune",
    "served_source": "dune",
    "fallback_reason": "none"
  },
  "snapshot": {
    "source": "dune",
    "generated_at": "2026-04-10T00:00:00.000Z",
    "next_refresh_at": "2026-04-10T01:00:00.000Z",
    "refresh_interval_seconds": 3600
  },
  "categories": ["sports", "crypto"],
  "platforms": ["polymarket", "kalshi"],
  "series": [
    { "date": "2026-04-03", "platform": "polymarket", "volume_usd": 0 },
    { "date": "2026-04-03", "platform": "kalshi", "volume_usd": 1200.5 }
  ],
  "empty": false,
  "message": null
}
```

## 2) GET /api/analytics/category-share

Category share + platform contribution per category.

### Response shape

```json
{
  "source": "live",
  "source_meta": {
    "requested_source": "dune",
    "served_source": "live",
    "fallback_reason": "dune_snapshot_missing"
  },
  "snapshot": null,
  "items": [
    {
      "category": "sports",
      "volume_usd": 100000,
      "share_pct": 42.1,
      "kalshi_volume_usd": 30000,
      "polymarket_volume_usd": 70000,
      "kalshi_share_in_category_pct": 30,
      "polymarket_share_in_category_pct": 70,
      "kalshi_share_of_total_pct": 12.63,
      "polymarket_share_of_total_pct": 29.47
    }
  ],
  "empty": false,
  "message": null
}
```

## 3) GET /api/analytics/delta

Period-over-period delta by platform.

### Response shape

```json
{
  "range": "30d",
  "source": "live",
  "source_meta": {
    "requested_source": "live",
    "served_source": "live",
    "fallback_reason": "none"
  },
  "snapshot": null,
  "comparison": {
    "current_start": "2026-03-11",
    "current_end": "2026-04-09",
    "previous_start": "2026-02-09",
    "previous_end": "2026-03-10"
  },
  "items": [
    {
      "platform": "polymarket",
      "current_volume_usd": 123456.78,
      "previous_volume_usd": 100000,
      "delta_pct": 23.46,
      "status": "up"
    },
    {
      "platform": "kalshi",
      "current_volume_usd": 80000,
      "previous_volume_usd": 0,
      "delta_pct": null,
      "status": "no_baseline"
    }
  ],
  "empty": false,
  "message": null
}
```

## 4) GET /api/analytics/anomalies

Anomaly markers (z-score по daily platform totals).

### Query-only

- `threshold` optional, default `2.5`

### Response shape

```json
{
  "threshold": 2.5,
  "source": "live",
  "source_meta": {
    "requested_source": "live",
    "served_source": "live",
    "fallback_reason": "none"
  },
  "snapshot": null,
  "items": [
    {
      "date": "2026-04-03",
      "platform": "polymarket",
      "volume_usd": 220000,
      "z_score": 3.17
    }
  ],
  "empty": false,
  "message": null
}
```

## 5) GET /api/analytics/export.csv

Экспорт агрегированных данных текущего фильтра.

- content type: `text/csv; charset=utf-8`
- filename: `volume_export_<range>_<YYYY-MM-DD>.csv`
- columns:

```text
date,platform,category,volume_usd
```

## 6) GET /api/analytics/last-updated

Freshness metadata.

```json
{
  "latest_updated_at": "2026-04-10T00:04:01.000Z",
  "sources": {
    "daily_volume": "2026-04-10T00:04:01.000Z",
    "daily_volume_platform_total": "2026-04-10T00:04:01.000Z",
    "hourly_volume": "2026-04-10T00:04:01.000Z",
    "ingestion": "2026-04-10T00:04:01.000Z"
  }
}
```

## 7) GET /api/analytics/stream

SSE stream freshness updates.

- content type: `text/event-stream`
- emits payload of `/analytics/last-updated`
- server emit interval: ~15s

## 8) GET /api/health

```json
{
  "ok": true,
  "services": { "db": "up" }
}
```

## 9) Caching

- short in-memory cache на hot JSON analytics endpoints (`~10s`)
- при `source=dune` backend дополнительно пытается warm-up live cache в фоне

