# MVP Specification

## Product goal

Create a clean local dashboard that compares historical trading volume between Polymarket and Kalshi.

The dashboard is public, without login, and must feel like a polished demo rather than a raw internal tool.

## Required features

## 1. Main hero chart

A primary line chart displayed in the hero section.

Requirements:
- show **both platforms on the same chart**
- X axis = date
- Y axis = trading volume in USD
- separate line per platform
- legend with visual color distinction
- chart should update according to selected filters
- chart should show empty-state messaging when no categories are selected or no data matches filters

Supported time ranges:
- 7 days
- 30 days
- 90 days
- all time

Preferred aggregation:
- daily

## 2. Category filtering

Canonical category list:

- sports
- crypto
- politics
- geopolitics
- finance
- culture
- tech_science
- other

Requirements:
- multi-select toggles or checkbox filter group
- enabled/disabled categories must affect all charts and KPI blocks
- if all categories are deselected, show a clear empty state message
- category selection must apply consistently across the dashboard

## 3. Market share pie chart

A secondary visualization showing volume share distribution by category.

Requirements:
- based on filtered data
- can show overall combined market share by category for current date range
- legend required
- handle no-data state gracefully

## 4. Period-over-period delta

Show percentage change in trading volume.

Definition:
- compare selected period versus immediately preceding equivalent period

Examples:
- selected 7 days -> compare against previous 7 days
- selected 30 days -> compare against previous 30 days
- selected 90 days -> compare against previous 90 days

Formula:

```text
(current_period_volume - previous_period_volume) / previous_period_volume * 100
```

Requirements:
- show delta per platform
- handle divide-by-zero case
- display positive/negative/neutral states clearly
- if previous period has no data, show a safe fallback value/state

## 5. Anomaly peak detection

Highlight unusual volume spikes.

Method:
- z-score based anomaly detection

MVP definition:
- compute z-score on daily volume points within a recent rolling window or selected range
- mark points above configured threshold as anomalies

Recommended default threshold:
- z >= 2.5 or z >= 3.0

Requirements:
- show anomaly markers on the hero chart
- anomaly logic should be documented and deterministic
- empty or insufficient data should not break the UI

## 6. Dark mode

Requirements:
- explicit theme toggle
- both light and dark themes supported
- chart rendering should remain readable in both themes
- theme should persist in local storage

## 7. CSV export

Requirements:
- export aggregated data, not raw trades
- export current filtered view
- include date/platform/category/volume_usd
- file should reflect selected date range and category filters

CSV schema:

```text
date,platform,category,volume_usd
```

## 8. UI quality requirements

The dashboard must include:

- clean modern layout
- responsive design
- loading skeletons or loading states
- clear error states
- clear empty states
- accessible labels for controls
- understandable tooltips or helper text where useful

## 9. Rational data scope for MVP/demo

Use a rational demo-oriented limit:

- keep full daily aggregate history for all available fetched data
- keep only recent raw trades for operational support
- do not attempt to store unlimited high-frequency raw history if not needed

Recommended raw data retention:
- 30 days

Recommended chart basis:
- daily volume only

Reason:
- enough for strong demo value
- simpler queries
- lower local resource usage
- easier debugging

## 10. Public dashboard assumptions

- no login
- no personalization
- no per-user saved filters
- no admin panel in MVP

## 11. Acceptance criteria

The MVP is acceptable only if all of the following are true:

1. Main chart shows both platforms on one graph
2. Date ranges 7/30/90/all work correctly
3. Category filters affect chart results
4. Deselected-all categories show a clear message
5. Pie chart updates with filters
6. Delta compares selected period to previous equivalent period
7. Anomaly peaks are visibly marked
8. Dark mode works
9. CSV export downloads current filtered aggregate data
10. Loading/error/empty states are implemented
11. The app runs locally with docker-compose
