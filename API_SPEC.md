# API Specification

## Overview

The backend serves aggregated analytics data for the local public dashboard.

The frontend should never call upstream platform APIs directly.

Base path example:
`/api`

## Common query behavior

### Supported period presets
- `7d`
- `30d`
- `90d`
- `all`

### Supported categories
- sports
- crypto
- politics
- geopolitics
- finance
- culture
- tech_science
- other

### Supported platforms
- polymarket
- kalshi

### General validation rules
- if no categories are selected, return an empty dataset with a clear message field
- invalid platforms/categories should return `400`
- all numeric outputs must be stable and explicit
- CSV export should reflect the same filters as chart endpoints

## 1. GET /api/analytics/volume

Returns the main time-series data for the hero chart.

### Query params
- `range=7d|30d|90d|all`
- `categories=sports,crypto,...`
- `platforms=polymarket,kalshi`

### Response
```json
{
  "range": "30d",
  "categories": ["sports", "crypto"],
  "platforms": ["polymarket", "kalshi"],
  "series": [
    {
      "date": "2026-03-01",
      "platform": "polymarket",
      "volume_usd": 123456.78
    },
    {
      "date": "2026-03-01",
      "platform": "kalshi",
      "volume_usd": 98765.43
    }
  ],
  "empty": false,
  "message": null
}
```

## 2. GET /api/analytics/category-share

Returns pie chart data for category share within current filters/date range.

### Query params
- `range=7d|30d|90d|all`
- `categories=sports,crypto,...`
- optional `platforms=polymarket,kalshi`

### Response
```json
{
  "items": [
    { "category": "sports", "volume_usd": 100000.00, "share_pct": 42.1 },
    { "category": "crypto", "volume_usd": 70000.00, "share_pct": 29.5 },
    { "category": "politics", "volume_usd": 67500.00, "share_pct": 28.4 }
  ],
  "empty": false,
  "message": null
}
```

## 3. GET /api/analytics/delta

Returns period-over-period delta per platform.

### Query params
- `range=7d|30d|90d|all`
- `categories=sports,crypto,...`
- `platforms=polymarket,kalshi`

### Response
```json
{
  "range": "30d",
  "comparison": {
    "current_start": "2026-03-10",
    "current_end": "2026-04-08",
    "previous_start": "2026-02-08",
    "previous_end": "2026-03-09"
  },
  "items": [
    {
      "platform": "polymarket",
      "current_volume_usd": 123456.78,
      "previous_volume_usd": 100000.00,
      "delta_pct": 23.46,
      "status": "up"
    },
    {
      "platform": "kalshi",
      "current_volume_usd": 80000.00,
      "previous_volume_usd": 95000.00,
      "delta_pct": -15.79,
      "status": "down"
    }
  ]
}
```

## 4. GET /api/analytics/anomalies

Returns anomaly points for chart overlays.

### Query params
- `range=7d|30d|90d|all`
- `categories=sports,crypto,...`
- `platforms=polymarket,kalshi`
- optional `threshold=2.5`

### Response
```json
{
  "threshold": 2.5,
  "items": [
    {
      "date": "2026-04-03",
      "platform": "polymarket",
      "volume_usd": 220000.00,
      "z_score": 3.17
    }
  ]
}
```

## 5. GET /api/analytics/export.csv

Downloads current filtered aggregate data as CSV.

### Query params
- `range=7d|30d|90d|all`
- `categories=sports,crypto,...`
- `platforms=polymarket,kalshi`

### Response
- content type: `text/csv`
- filename example: `volume_export_30d_2026-04-09.csv`

### CSV schema
```text
date,platform,category,volume_usd
```

## 6. GET /api/health

Simple health endpoint.

### Response
```json
{
  "ok": true,
  "services": {
    "db": "up"
  }
}
```

## API design rules

1. Use aggregate tables for analytics responses
2. Return stable empty states rather than ambiguous null payloads
3. Keep response shapes predictable
4. Do not expose raw upstream payloads to the frontend
5. Validate and sanitize all query parameters
