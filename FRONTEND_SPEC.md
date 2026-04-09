# Frontend Specification

## Stack

- React
- Vite
- TypeScript recommended
- chart library can be Recharts or another lightweight React charting library
- styling can be done with CSS modules, plain CSS, or a minimal utility approach
- do not over-engineer the component system

## Product goal

Build a clean, modern, responsive dashboard that compares Polymarket vs Kalshi trading volume.

This should feel like a polished public demo.

## Page structure

Recommended single-page dashboard layout:

1. Header
   - project title
   - dark mode toggle
   - export CSV button

2. Controls section
   - time range selector: 7d / 30d / 90d / all
   - category filters

3. Hero section
   - main line chart with both platforms on one graph
   - legend
   - empty state / loading state / error state

4. KPI section
   - delta cards per platform

5. Secondary chart section
   - pie chart for category share

6. Optional helper section
   - anomaly explanation
   - last updated timestamp

## Required components

Suggested component list:

- `DashboardPage`
- `DashboardHeader`
- `ThemeToggle`
- `RangeSelector`
- `CategoryFilterGroup`
- `HeroVolumeChart`
- `DeltaCards`
- `CategoryShareChart`
- `ExportCsvButton`
- `LoadingState`
- `ErrorState`
- `EmptyState`

## State model

Suggested dashboard state:

```ts
type RangePreset = '7d' | '30d' | '90d' | 'all';

type DashboardFilters = {
  range: RangePreset;
  categories: string[];
  platforms: ('polymarket' | 'kalshi')[];
};
```

Default behavior:
- default range: `30d`
- default categories: all selected
- default platforms: both selected

## Data fetching

Recommended approach:
- fetch from own backend API only
- one request per widget or one composed dashboard request
- either approach is acceptable for MVP, but keep code readable

Suggested endpoints:
- `/api/analytics/volume`
- `/api/analytics/delta`
- `/api/analytics/category-share`
- `/api/analytics/anomalies`
- `/api/analytics/export.csv`

Recommended UX:
- loading skeleton on first load
- lightweight loading state on filter change
- debounced updates if needed, e.g. 200-300ms

## Hero chart requirements

The main chart is the visual center of the dashboard.

Requirements:
- line chart
- two lines: Polymarket and Kalshi
- X axis: date
- Y axis: volume in USD
- visible legend
- anomaly markers rendered on corresponding points
- tooltip with date/platform/value
- readable in light and dark mode

Behavior:
- reacts to selected date range
- reacts to category filters
- if no categories selected -> show clear empty state
- if API fails -> show clear error state

## Category filter behavior

Requirements:
- multi-select
- visible selected/unselected state
- category changes update all widgets
- if all categories are deselected:
  - charts do not render misleading zero lines
  - show explanatory empty state

Canonical categories:
- sports
- crypto
- politics
- geopolitics
- finance
- culture
- tech_science
- other

Display label suggestion:
- show `tech & science` in UI, but keep internal value `tech_science`

## Delta cards

Requirements:
- one card per platform
- show current period volume
- show previous period volume
- show delta percentage
- show positive/negative/neutral visual treatment
- handle no baseline data safely

## Pie chart requirements

Requirements:
- category share by volume for active filters
- legend required
- no-data state required
- values should be understandable without clutter

## Dark mode

Requirements:
- manual theme toggle
- theme persisted in localStorage
- chart colors remain readable in both themes
- all UI surfaces must adapt consistently

## CSV export

Requirements:
- export current filtered aggregate view
- button should indicate loading state if needed
- use backend-generated CSV rather than client-side reconstruction when possible

## Error and empty states

Must include:
- initial loading state
- refetch/loading-on-filter-change state
- API error state
- empty result state
- all-categories-disabled state with explicit message

Suggested empty message:
- "Select at least one category to display volume data."

## Responsive behavior

Requirements:
- desktop-first but fully usable on smaller screens
- filters should wrap or stack
- hero chart remains readable on mobile
- pie chart and delta cards should reflow cleanly

## Accessibility basics

Include:
- buttons with labels
- keyboard-focusable controls
- visible focus states
- sufficient color contrast
- legend and chart labels that are understandable

## Implementation rule for Codex

Do not build a visually raw admin tool.
Build a polished demo dashboard with:
- clean spacing
- restrained typography
- clear hierarchy
- explicit states
- modern but simple interactions
