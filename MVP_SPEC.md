# MVP Specification (Implemented Scope)

## Product goal

Локальный публичный dashboard для сравнения торгового объёма Polymarket и Kalshi с удобным UX и стабильными live-обновлениями.

## Core requirements

## 1) Main comparison chart

- объединённый график по платформам
- диапазоны: `7d`, `30d`, `90d`, `all`
- daily aggregation
- line/bar mode switch
- platform visibility toggles (`Kalshi`, `Polymarket`, `Total`)
- rich tooltip (values + shares + edge direction)

Range behavior:

- finite ranges anchored к текущему UTC дню
- day-padding (пропуски -> `0`) для стабильной геометрии

## 2) Category filtering

Canonical categories:

- sports
- crypto
- politics
- geopolitics
- finance
- culture
- tech_science
- other

Requirements:

- multi-select category chips
- фильтр влияет на все виджеты
- если все категории выключены -> явный empty state

## 3) Category comparison block

- сравнение Kalshi vs Polymarket по каждой категории
- абсолютные значения + доли:
  - доля платформы внутри категории
  - доля платформы от общего объёма
- визуальные горизонтальные bars
- desktop table layout + mobile card layout

## 4) Source modes

- `Dune Snapshot` по умолчанию
- `Live API` по переключателю
- отображение source metadata:
  - snapshot generated/next refresh
  - live stream status + last update

## 5) Delta and anomalies (API-ready)

MVP backend includes:

- period-over-period delta endpoint
- z-score anomalies endpoint

Frontend shared hook already fetches these endpoints; расширение визуализации возможно без изменения API контракта.

## 6) Theme + i18n

- light/dark theme toggle (persisted)
- RU/EN language switch (persisted)
- readable contrast in both themes

## 7) CSV export

- экспорт aggregate rows для текущего фильтра
- schema:

```text
date,platform,category,volume_usd
```

## 8) UX requirements

- loading / error / empty states
- live updates без full-page reset/scroll jump
- mobile-first usability (без обязательного horizontal scroll)

## 9) Data assumptions

- frontend работает только с локальным backend
- official APIs — основной ingestion source
- The Graph — fallback для Polymarket
- Dune snapshot — cached source layer, не замена official ingestion

## Acceptance checklist

1. Chart корректно показывает обе платформы
2. `7d/30d/90d/all` работают корректно
3. Category filters применяются везде
4. Empty-state при пустом category selection
5. Category comparison показывает absolute + percentage metrics
6. Source switch (`dune/live`) работает с metadata
7. Theme toggle + persistence
8. Language switch + persistence
9. CSV export соответствует активным фильтрам
10. Live updates не ломают scroll/state
11. Проект поднимается локально через `docker compose`

