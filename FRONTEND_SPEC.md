# Frontend Specification

## Stack

- React 18 + Vite
- TypeScript
- Recharts
- CSS + inline style system for dashboard sections

## Product goal

Современный dashboard для сравнения объёмов Polymarket vs Kalshi с двумя режимами источника:

- `Dune Snapshot` (default)
- `Live API`

## Current UI composition

1. Sticky header
- product title
- export CSV button
- language switch (`RU/EN`)
- theme toggle

2. Top hero block
- source status line (snapshot/live, timestamps, stream state)
- hero chart title

3. Chart control panel
- source segmented control
- range segmented control (`7d/30d/90d/all`)
- chart type (`lines/bars`)
- per-series visibility toggles (`Kalshi`, `Polymarket`, `Total`)
- category chips filter

4. Main chart
- area/bar mode
- custom tooltip (platform values, total, edge direction)
- responsive sizing for desktop/mobile

5. Metric cards
- `Kalshi`, `Polymarket`, `Summary`
- absolute values + share of total

6. Category comparison
- desktop: table-like grid with platform bars and totals
- mobile: per-category cards (без горизонтального скролла)

## Data model in UI

`useDashboardData` запрашивает:

- `/api/analytics/volume`
- `/api/analytics/category-share`
- `/api/analytics/delta`
- `/api/analytics/anomalies`
- `/api/analytics/last-updated`

`delta/anomalies` уже загружаются в shared hook и готовы для расширения UI.

## Live update behavior

- SSE: `/api/analytics/stream`
- при событии обновляется refresh signal
- выполняется background refetch
- страница/скролл не сбрасываются
- initial load vs refreshing state разделены

## i18n behavior

- centralized dictionary: `frontend/src/i18n.ts`
- persisted language key: `pm-kalshi-lang`
- supported locales: `ru`, `en`
- переведены все ключевые user-facing строки текущего UI

## Theme behavior

- persisted theme key: `pm-kalshi-theme`
- light/dark palettes
- dark palette улучшена по контрасту (text, muted, axis, grid)

## Responsive behavior

- breakpoint logic в `App.tsx` через `matchMedia("(max-width: 900px)")`
- mobile adjustments:
  - compact header/actions
  - controls stack into full-width rows
  - reduced chart height + axis font sizes
  - KPI cards in single column
  - category comparison as cards

## Accessibility baseline

- labeled interactive controls (`aria-label`, visible labels)
- keyboard-accessible buttons/toggles
- readable contrast in both themes

