import { pool } from "../db/pool.js";
import {
  EMPTY_CATEGORIES_MESSAGE,
  RANGE_DAYS,
  type DataSource,
  type Platform,
  type RangePreset,
} from "../config/constants.js";
import { getDuneSnapshotRows, getDuneSnapshotDeltaTotals } from "./dune-snapshot.js";
import type { ParsedFilters } from "../utils/filters.js";

type DateWindow = {
  startDate: string | null;
  endDate: string | null;
};

type DeltaWindow = {
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
};

type DayPlatformVolume = {
  date: string;
  platform: Platform;
  volume_usd: number;
};

type VolumeResponseRow = {
  date: string;
  platform: Platform;
  volume_usd: number | string;
};

type DailyCategoryRow = {
  date: string;
  platform: Platform;
  category: string;
  volume_usd: number;
};

type SnapshotMeta = {
  source: DataSource;
  generated_at: string | null;
  next_refresh_at: string | null;
  refresh_interval_seconds: number | null;
};

type SourceMeta = {
  requested_source: DataSource;
  served_source: DataSource;
  fallback_reason: "none" | "dune_snapshot_missing" | "live_empty_use_last_good_cache";
};

type SourceDataResult = {
  rows: DailyCategoryRow[];
  snapshot: SnapshotMeta | null;
  sourceMeta: SourceMeta;
};

const lastGoodLiveRowsCache = new Map<string, DailyCategoryRow[]>();

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDaysUtc(base: Date, days: number): Date {
  const next = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function resolveDateWindow(range: RangePreset): DateWindow {
  if (range === "all") {
    return { startDate: null, endDate: null };
  }

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const days = RANGE_DAYS[range];

  return {
    startDate: formatUtcDate(addDaysUtc(today, -(days - 1))),
    endDate: formatUtcDate(today),
  };
}

function computeStats(values: number[]): { mean: number; stdDev: number } {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;

  return {
    mean,
    stdDev: Math.sqrt(variance),
  };
}

function toNumber(value: string | number): number {
  if (typeof value === "number") {
    return value;
  }

  return Number(value);
}

function canUseDuneFallback(): boolean {
  return true;
}

function dayBefore(date: string): string {
  const base = new Date(`${date}T00:00:00.000Z`);
  return formatUtcDate(addDaysUtc(base, -1));
}

function resolveBoundsForFetch(range: RangePreset): { startDate: string; endDate: string } {
  const window = resolveDateWindow(range);
  if (window.startDate && window.endDate) {
    return { startDate: window.startDate, endDate: window.endDate };
  }
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return {
    startDate: "1970-01-01",
    endDate: formatUtcDate(today),
  };
}

function buildLiveRowsKey(filters: ParsedFilters): string {
  return `${filters.range}|${filters.categories.join(",")}|${filters.platforms.join(",")}`;
}

async function getEarliestLocalDate(filters: ParsedFilters): Promise<string | null> {
  const result = await pool.query<{ min_day: string | null }>(
    `
      SELECT MIN(day)::text AS min_day
      FROM daily_volume
      WHERE canonical_category = ANY($1::text[])
        AND platform = ANY($2::text[])
    `,
    [filters.categories, filters.platforms],
  );
  return result.rows[0]?.min_day ?? null;
}

async function getLocalDailyCategoryRows(
  filters: ParsedFilters,
  startDate: string | null,
  endDate: string | null,
): Promise<DailyCategoryRow[]> {
  const result = await pool.query<{
    date: string;
    platform: Platform;
    category: string;
    volume_usd: number | string;
  }>(
    `
      SELECT
        day::text AS date,
        platform,
        canonical_category AS category,
        SUM(volume_usd)::float8 AS volume_usd
      FROM daily_volume
      WHERE canonical_category = ANY($1::text[])
        AND platform = ANY($2::text[])
        AND ($3::date IS NULL OR day >= $3::date)
        AND ($4::date IS NULL OR day <= $4::date)
      GROUP BY day, platform, canonical_category
      ORDER BY day ASC, platform ASC, canonical_category ASC
    `,
    [filters.categories, filters.platforms, startDate, endDate],
  );

  return result.rows.map((row) => ({
    date: row.date,
    platform: row.platform,
    category: row.category,
    volume_usd: toNumber(row.volume_usd),
  }));
}

function mergeDailyCategoryRows(rows: DailyCategoryRow[]): DailyCategoryRow[] {
  const merged = new Map<string, DailyCategoryRow>();
  for (const row of rows) {
    const key = `${row.date}:${row.platform}:${row.category}`;
    const existing = merged.get(key);
    if (existing) {
      existing.volume_usd += row.volume_usd;
    } else {
      merged.set(key, { ...row });
    }
  }

  const out = [...merged.values()];
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.platform.localeCompare(b.platform));
}

async function getCombinedDailyCategoryRows(
  filters: ParsedFilters,
  startDate: string | null,
  endDate: string | null,
): Promise<DailyCategoryRow[]> {
  const localRows = await getLocalDailyCategoryRows(filters, startDate, endDate);
  if (!startDate || !endDate || !canUseDuneFallback()) {
    return localRows;
  }

  const earliestLocal = await getEarliestLocalDate(filters);
  let missingStart: string | null = null;
  let missingEnd: string | null = null;

  if (!earliestLocal) {
    missingStart = startDate;
    missingEnd = endDate;
  } else if (earliestLocal > startDate) {
    missingStart = startDate;
    missingEnd = dayBefore(earliestLocal);
    if (missingEnd < missingStart) {
      missingStart = null;
      missingEnd = null;
    }
    if (missingEnd && missingEnd > endDate) {
      missingEnd = endDate;
    }
  }

  if (!missingStart || !missingEnd) {
    return localRows;
  }

  try {
    const duneSnapshot = await getDuneSnapshotRows(filters.range, filters.categories, filters.platforms);
    const duneRows = duneSnapshot.rows.filter(
      (row) => row.date >= missingStart && row.date <= missingEnd,
    );
    return mergeDailyCategoryRows([...localRows, ...duneRows]);
  } catch (error) {
    console.error("Dune historical fallback failed", error);
    return localRows;
  }
}

async function getDailyCategoryRowsBySource(
  filters: ParsedFilters,
  startDate: string | null,
  endDate: string | null,
): Promise<SourceDataResult> {
  if (filters.source === "live") {
    const rows = await getCombinedDailyCategoryRows(filters, startDate, endDate);
    const key = buildLiveRowsKey(filters);
    if (rows.length > 0) {
      lastGoodLiveRowsCache.set(key, rows);
    }
    if (rows.length === 0 && lastGoodLiveRowsCache.has(key)) {
      return {
        rows: lastGoodLiveRowsCache.get(key) ?? [],
        snapshot: {
          source: "live",
          generated_at: null,
          next_refresh_at: null,
          refresh_interval_seconds: null,
        },
        sourceMeta: {
          requested_source: "live",
          served_source: "live",
          fallback_reason: "live_empty_use_last_good_cache",
        },
      };
    }
    return {
      rows,
      snapshot: {
        source: "live",
        generated_at: null,
        next_refresh_at: null,
        refresh_interval_seconds: null,
      },
      sourceMeta: {
        requested_source: "live",
        served_source: "live",
        fallback_reason: "none",
      },
    };
  }
  const dune = await getDuneSnapshotRows(filters.range, filters.categories, filters.platforms);

  if (dune.rows.length === 0) {
    const liveFilters: ParsedFilters = { ...filters, source: "live" };
    const liveRows = await getCombinedDailyCategoryRows(liveFilters, startDate, endDate);
    if (liveRows.length > 0) {
      lastGoodLiveRowsCache.set(buildLiveRowsKey(liveFilters), liveRows);
    }
    return {
      rows: liveRows,
      snapshot: dune.snapshot,
      sourceMeta: {
        requested_source: "dune",
        served_source: "live",
        fallback_reason: "dune_snapshot_missing",
      },
    };
  }

  return {
    rows: dune.rows,
    snapshot: {
      source: "dune",
      generated_at: dune.snapshot?.generated_at ?? null,
      next_refresh_at: dune.snapshot?.next_refresh_at ?? null,
      refresh_interval_seconds: dune.snapshot?.refresh_interval_seconds ?? 3600,
    },
    sourceMeta: {
      requested_source: "dune",
      served_source: "dune",
      fallback_reason: "none",
    },
  };
}

export async function getVolume(filters: ParsedFilters) {
  if (filters.categories.length === 0) {
    return {
      range: filters.range,
      categories: [],
      platforms: filters.platforms,
      source: filters.source,
      source_meta: {
        requested_source: filters.source,
        served_source: filters.source,
        fallback_reason: "none",
      },
      snapshot: null,
      series: [],
      empty: true,
      message: EMPTY_CATEGORIES_MESSAGE,
    };
  }

  const window = resolveDateWindow(filters.range);
  const sourceData = await getDailyCategoryRowsBySource(filters, window.startDate, window.endDate);
  const categoryRows = sourceData.rows;
  const dayPlatform = new Map<string, DayPlatformVolume>();
  for (const row of categoryRows) {
    const key = `${row.date}:${row.platform}`;
    const existing = dayPlatform.get(key);
    if (existing) {
      existing.volume_usd += row.volume_usd;
    } else {
      dayPlatform.set(key, {
        date: row.date,
        platform: row.platform,
        volume_usd: row.volume_usd,
      });
    }
  }
  const fetchedSeries: DayPlatformVolume[] = [...dayPlatform.values()];
  fetchedSeries.sort((a, b) => a.date.localeCompare(b.date) || a.platform.localeCompare(b.platform));

  let series = fetchedSeries;
  if (filters.range !== "all" && window.startDate && window.endDate) {
    const byKey = new Map<string, number>();
    for (const point of fetchedSeries) {
      byKey.set(`${point.date}:${point.platform}`, point.volume_usd);
    }

    const start = new Date(`${window.startDate}T00:00:00.000Z`);
    const end = new Date(`${window.endDate}T00:00:00.000Z`);
    const padded: DayPlatformVolume[] = [];
    for (let cursor = new Date(start); cursor <= end; cursor = addDaysUtc(cursor, 1)) {
      const day = formatUtcDate(cursor);
      for (const platform of filters.platforms) {
        const key = `${day}:${platform}`;
        padded.push({
          date: day,
          platform,
          volume_usd: byKey.get(key) ?? 0,
        });
      }
    }
    series = padded;
  }

  return {
    range: filters.range,
    categories: filters.categories,
    platforms: filters.platforms,
    source: filters.source,
    source_meta: sourceData.sourceMeta,
    snapshot: sourceData.snapshot,
    series,
    empty: series.length === 0,
    message: series.length === 0 ? "No data found for selected filters." : null,
  };
}

export async function getCategoryShare(filters: ParsedFilters) {
  if (filters.categories.length === 0) {
    return {
      source: filters.source,
      source_meta: {
        requested_source: filters.source,
        served_source: filters.source,
        fallback_reason: "none",
      },
      snapshot: null,
      items: [],
      empty: true,
      message: EMPTY_CATEGORIES_MESSAGE,
    };
  }

  const window = resolveDateWindow(filters.range);
  const sourceData = await getDailyCategoryRowsBySource(filters, window.startDate, window.endDate);
  const rows = sourceData.rows;
  const byCategory = new Map<string, { kalshi: number; polymarket: number; total: number }>();
  let grandTotal = 0;
  for (const row of rows) {
    const existing = byCategory.get(row.category) ?? { kalshi: 0, polymarket: 0, total: 0 };
    if (row.platform === "kalshi") {
      existing.kalshi += row.volume_usd;
    } else if (row.platform === "polymarket") {
      existing.polymarket += row.volume_usd;
    }
    existing.total += row.volume_usd;
    grandTotal += row.volume_usd;
    byCategory.set(row.category, existing);
  }
  const sorted = [...byCategory.entries()].sort((a, b) => b[1].total - a[1].total);

  const items = sorted.map(([category, volume]) => {
    const share = grandTotal > 0 ? (volume.total / grandTotal) * 100 : 0;
    const kalshiShareInCategory = volume.total > 0 ? (volume.kalshi / volume.total) * 100 : 0;
    const polymarketShareInCategory = volume.total > 0 ? (volume.polymarket / volume.total) * 100 : 0;
    const kalshiShareOfTotal = grandTotal > 0 ? (volume.kalshi / grandTotal) * 100 : 0;
    const polymarketShareOfTotal = grandTotal > 0 ? (volume.polymarket / grandTotal) * 100 : 0;

    return {
      category,
      volume_usd: Number(volume.total.toFixed(2)),
      share_pct: Number(share.toFixed(2)),
      kalshi_volume_usd: Number(volume.kalshi.toFixed(2)),
      polymarket_volume_usd: Number(volume.polymarket.toFixed(2)),
      kalshi_share_in_category_pct: Number(kalshiShareInCategory.toFixed(2)),
      polymarket_share_in_category_pct: Number(polymarketShareInCategory.toFixed(2)),
      kalshi_share_of_total_pct: Number(kalshiShareOfTotal.toFixed(2)),
      polymarket_share_of_total_pct: Number(polymarketShareOfTotal.toFixed(2)),
    };
  });

  return {
    source: filters.source,
    source_meta: sourceData.sourceMeta,
    snapshot: sourceData.snapshot,
    items,
    empty: items.length === 0,
    message: items.length === 0 ? "No category share data for selected filters." : null,
  };
}

async function resolveDeltaWindow(filters: ParsedFilters): Promise<DeltaWindow | null> {
  if (filters.range !== "all") {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const periodDays = RANGE_DAYS[filters.range];

    const currentStartDate = addDaysUtc(today, -(periodDays - 1));
    const previousEndDate = addDaysUtc(currentStartDate, -1);
    const previousStartDate = addDaysUtc(previousEndDate, -(periodDays - 1));

    return {
      currentStart: formatUtcDate(currentStartDate),
      currentEnd: formatUtcDate(today),
      previousStart: formatUtcDate(previousStartDate),
      previousEnd: formatUtcDate(previousEndDate),
    };
  }

  let minDay: string | null = null;
  let maxDay: string | null = null;

  if (filters.source === "live") {
    const bounds = await pool.query<{ min_day: string | null; max_day: string | null }>(
      `
        SELECT
          MIN(day)::text AS min_day,
          MAX(day)::text AS max_day
        FROM daily_volume
        WHERE canonical_category = ANY($1::text[])
          AND platform = ANY($2::text[])
      `,
      [filters.categories, filters.platforms],
    );
    minDay = bounds.rows[0]?.min_day ?? null;
    maxDay = bounds.rows[0]?.max_day ?? null;
  } else {
    return null;
  }

  if (!minDay || !maxDay) {
    return null;
  }

  const startDate = new Date(`${minDay}T00:00:00.000Z`);
  const endDate = new Date(`${maxDay}T00:00:00.000Z`);
  const periodDays = Math.max(
    1,
    Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  );

  const previousEnd = addDaysUtc(startDate, -1);
  const previousStart = addDaysUtc(previousEnd, -(periodDays - 1));

  return {
    currentStart: minDay,
    currentEnd: maxDay,
    previousStart: formatUtcDate(previousStart),
    previousEnd: formatUtcDate(previousEnd),
  };
}

export async function getDelta(filters: ParsedFilters) {
  if (filters.categories.length === 0) {
    return {
      range: filters.range,
      source: filters.source,
      source_meta: {
        requested_source: filters.source,
        served_source: filters.source,
        fallback_reason: "none",
      },
      snapshot: null,
      comparison: null,
      items: [],
      empty: true,
      message: EMPTY_CATEGORIES_MESSAGE,
    };
  }

  if (filters.source === "dune" && filters.range !== "all") {
    const duneDelta = await getDuneSnapshotDeltaTotals(filters.range);
    const previous = duneDelta.previous;
    if (!previous) {
      const liveWindow = await resolveDeltaWindow({ ...filters, source: "live" });
      if (!liveWindow) {
        return {
          range: filters.range,
          source: filters.source,
          source_meta: {
            requested_source: filters.source,
            served_source: filters.source,
            fallback_reason: "none",
          },
          snapshot: duneDelta.snapshot,
          comparison: null,
          items: [],
          empty: true,
          message: "No previous snapshot window available for delta.",
        };
      }
      const sourceData = await getDailyCategoryRowsBySource(
        { ...filters, source: "live" },
        liveWindow.previousStart,
        liveWindow.currentEnd,
      );
      const rows = sourceData.rows;
      const byPlatform = new Map<Platform, { current: number; previous: number }>();
      for (const platform of filters.platforms) {
        byPlatform.set(platform, { current: 0, previous: 0 });
      }
      for (const row of rows) {
        const agg = byPlatform.get(row.platform) ?? { current: 0, previous: 0 };
        if (row.date >= liveWindow.currentStart && row.date <= liveWindow.currentEnd) {
          agg.current += row.volume_usd;
        } else if (row.date >= liveWindow.previousStart && row.date <= liveWindow.previousEnd) {
          agg.previous += row.volume_usd;
        }
        byPlatform.set(row.platform, agg);
      }
      const items = [...byPlatform.entries()].map(([platform, agg]) => {
        const current = agg.current;
        const previousVolume = agg.previous;
        let deltaPct: number | null = null;
        let status: "up" | "down" | "neutral" | "no_baseline" = "neutral";
        if (previousVolume === 0) {
          status = current === 0 ? "neutral" : "no_baseline";
        } else {
          deltaPct = ((current - previousVolume) / previousVolume) * 100;
          if (deltaPct > 0) status = "up";
          else if (deltaPct < 0) status = "down";
        }
        return {
          platform,
          current_volume_usd: Number(current.toFixed(2)),
          previous_volume_usd: Number(previousVolume.toFixed(2)),
          delta_pct: deltaPct === null ? null : Number(deltaPct.toFixed(2)),
          status,
        };
      });
      return {
        range: filters.range,
        source: filters.source,
        source_meta: {
          requested_source: filters.source,
          served_source: "live",
          fallback_reason: "dune_snapshot_missing",
        },
        snapshot: duneDelta.snapshot,
        comparison: {
          current_start: liveWindow.currentStart,
          current_end: liveWindow.currentEnd,
          previous_start: liveWindow.previousStart,
          previous_end: liveWindow.previousEnd,
        },
        items,
        empty: items.length === 0,
        message: items.length === 0 ? "No delta data for selected filters." : null,
      };
    }

    const items = (["polymarket", "kalshi"] as const)
      .filter((platform) => filters.platforms.includes(platform))
      .map((platform) => {
        const current = platform === "polymarket" ? duneDelta.current.polymarket : duneDelta.current.kalshi;
        const prev = platform === "polymarket" ? previous.polymarket : previous.kalshi;

        let deltaPct: number | null = null;
        let status: "up" | "down" | "neutral" | "no_baseline" = "neutral";

        if (prev === 0) {
          status = current === 0 ? "neutral" : "no_baseline";
        } else {
          deltaPct = ((current - prev) / prev) * 100;
          if (deltaPct > 0) status = "up";
          else if (deltaPct < 0) status = "down";
        }

        return {
          platform,
          current_volume_usd: Number(current.toFixed(2)),
          previous_volume_usd: Number(prev.toFixed(2)),
          delta_pct: deltaPct === null ? null : Number(deltaPct.toFixed(2)),
          status,
        };
      });

    return {
      range: filters.range,
      source: filters.source,
      source_meta: {
        requested_source: filters.source,
        served_source: filters.source,
        fallback_reason: "none",
      },
      snapshot: duneDelta.snapshot,
      comparison: null,
      items,
      empty: items.length === 0,
      message: items.length === 0 ? "No delta data for selected filters." : null,
    };
  }

  const window = await resolveDeltaWindow(filters);
  if (!window) {
    return {
      range: filters.range,
      source: filters.source,
      source_meta: {
        requested_source: filters.source,
        served_source: filters.source,
        fallback_reason: "none",
      },
      snapshot: null,
      comparison: null,
      items: [],
      empty: true,
      message: "No data available for delta calculation.",
    };
  }

  const sourceData = await getDailyCategoryRowsBySource(filters, window.previousStart, window.currentEnd);
  const rows = sourceData.rows;
  const byPlatform = new Map<Platform, { current: number; previous: number }>();
  for (const platform of filters.platforms) {
    byPlatform.set(platform, { current: 0, previous: 0 });
  }
  for (const row of rows) {
    const agg = byPlatform.get(row.platform) ?? { current: 0, previous: 0 };
    if (row.date >= window.currentStart && row.date <= window.currentEnd) {
      agg.current += row.volume_usd;
    } else if (row.date >= window.previousStart && row.date <= window.previousEnd) {
      agg.previous += row.volume_usd;
    }
    byPlatform.set(row.platform, agg);
  }

  const items = [...byPlatform.entries()].map(([platform, agg]) => {
    const current = agg.current;
    const previous = agg.previous;

    let deltaPct: number | null = null;
    let status: "up" | "down" | "neutral" | "no_baseline" = "neutral";

    if (previous === 0) {
      status = current === 0 ? "neutral" : "no_baseline";
    } else {
      deltaPct = ((current - previous) / previous) * 100;
      if (deltaPct > 0) {
        status = "up";
      } else if (deltaPct < 0) {
        status = "down";
      }
    }

    return {
      platform,
      current_volume_usd: Number(current.toFixed(2)),
      previous_volume_usd: Number(previous.toFixed(2)),
      delta_pct: deltaPct === null ? null : Number(deltaPct.toFixed(2)),
      status,
    };
  });

  return {
    range: filters.range,
    source: filters.source,
    source_meta: sourceData.sourceMeta,
    snapshot: sourceData.snapshot,
    comparison: {
      current_start: window.currentStart,
      current_end: window.currentEnd,
      previous_start: window.previousStart,
      previous_end: window.previousEnd,
    },
    items,
    empty: items.length === 0,
    message: items.length === 0 ? "No delta data for selected filters." : null,
  };
}

export async function getAnomalies(filters: ParsedFilters) {
  if (filters.categories.length === 0) {
    return {
      threshold: filters.threshold ?? 2.5,
      source: filters.source,
      source_meta: {
        requested_source: filters.source,
        served_source: filters.source,
        fallback_reason: "none",
      },
      snapshot: null,
      items: [],
      empty: true,
      message: EMPTY_CATEGORIES_MESSAGE,
    };
  }

  const threshold = filters.threshold ?? 2.5;
  const window = resolveDateWindow(filters.range);
  const sourceData = await getDailyCategoryRowsBySource(filters, window.startDate, window.endDate);
  const rows = sourceData.rows;
  const dailyRowsMap = new Map<string, DayPlatformVolume>();
  for (const row of rows) {
    const key = `${row.date}:${row.platform}`;
    const existing = dailyRowsMap.get(key);
    if (existing) {
      existing.volume_usd += row.volume_usd;
    } else {
      dailyRowsMap.set(key, {
        date: row.date,
        platform: row.platform,
        volume_usd: row.volume_usd,
      });
    }
  }
  const dailyRows = [...dailyRowsMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  const byPlatform = new Map<Platform, DayPlatformVolume[]>();
  for (const row of dailyRows) {
    const current = byPlatform.get(row.platform) ?? [];
    current.push({
      date: row.date,
      platform: row.platform,
      volume_usd: toNumber(row.volume_usd),
    });
    byPlatform.set(row.platform, current);
  }

  const items: Array<{
    date: string;
    platform: Platform;
    volume_usd: number;
    z_score: number;
  }> = [];

  for (const [platform, points] of byPlatform.entries()) {
    if (points.length < 2) {
      continue;
    }

    const volumes = points.map((point) => point.volume_usd);
    const { mean, stdDev } = computeStats(volumes);

    if (stdDev === 0) {
      continue;
    }

    for (const point of points) {
      const zScore = (point.volume_usd - mean) / stdDev;
      if (zScore >= threshold) {
        items.push({
          date: point.date,
          platform,
          volume_usd: Number(point.volume_usd.toFixed(2)),
          z_score: Number(zScore.toFixed(2)),
        });
      }
    }
  }

  items.sort((a, b) => a.date.localeCompare(b.date));

  return {
    threshold,
    source: filters.source,
    source_meta: sourceData.sourceMeta,
    snapshot: sourceData.snapshot,
    items,
    empty: items.length === 0,
    message: items.length === 0 ? "No anomalies found for selected filters." : null,
  };
}

export async function getExportRows(filters: ParsedFilters) {
  if (filters.categories.length === 0) {
    return [] as Array<{ date: string; platform: string; category: string; volume_usd: number }>;
  }

  const window = resolveDateWindow(filters.range);
  const sourceData = await getDailyCategoryRowsBySource(filters, window.startDate, window.endDate);
  const rows = sourceData.rows;
  return rows.map((row) => ({
    date: row.date,
    platform: row.platform,
    category: row.category,
    volume_usd: Number(row.volume_usd.toFixed(2)),
  }));
}

export async function getLastUpdated() {
  const hourlyExistsResult = await pool.query<{ exists: string | null }>(
    `SELECT to_regclass('public.hourly_volume')::text AS exists`,
  );
  const hourlyExists = Boolean(hourlyExistsResult.rows[0]?.exists);

  const baseResult = await pool.query<{
    daily_updated_at: string | null;
    daily_total_updated_at: string | null;
    ingestion_updated_at: string | null;
  }>(
    `
      SELECT
        (SELECT MAX(updated_at)::text FROM daily_volume) AS daily_updated_at,
        (SELECT MAX(updated_at)::text FROM daily_volume_platform_total) AS daily_total_updated_at,
        (SELECT MAX(last_success_at)::text FROM ingestion_state) AS ingestion_updated_at
    `,
  );

  const hourlyUpdatedAt = hourlyExists
    ? (
        await pool.query<{ hourly_updated_at: string | null }>(
          `SELECT MAX(updated_at)::text AS hourly_updated_at FROM hourly_volume`,
        )
      ).rows[0]?.hourly_updated_at ?? null
    : null;

  const row = baseResult.rows[0] ?? {
    daily_updated_at: null,
    daily_total_updated_at: null,
    ingestion_updated_at: null,
  };

  const timestamps = [
    row.daily_updated_at,
    row.daily_total_updated_at,
    row.ingestion_updated_at,
    hourlyUpdatedAt,
  ].filter((value): value is string => value !== null);

  const latest =
    timestamps.length > 0
      ? timestamps.reduce((max, value) => (value > max ? value : max), timestamps[0] ?? "")
      : null;

  return {
    source: "live" as const,
    source_meta: {
      requested_source: "live" as const,
      served_source: "live" as const,
      fallback_reason: "none" as const,
    },
    snapshot: null,
    latest_updated_at: latest,
    sources: {
      daily_volume: row.daily_updated_at,
      daily_volume_platform_total: row.daily_total_updated_at,
      hourly_volume: hourlyUpdatedAt,
      ingestion: row.ingestion_updated_at,
    },
  };
}
