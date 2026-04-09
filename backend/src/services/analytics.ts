import { pool } from "../db/pool.js";
import {
  EMPTY_CATEGORIES_MESSAGE,
  RANGE_DAYS,
  type Platform,
  type RangePreset,
} from "../config/constants.js";
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

export async function getVolume(filters: ParsedFilters) {
  if (filters.categories.length === 0) {
    return {
      range: filters.range,
      categories: [],
      platforms: filters.platforms,
      series: [],
      empty: true,
      message: EMPTY_CATEGORIES_MESSAGE,
    };
  }

  const window = resolveDateWindow(filters.range);
  const result = await pool.query<DayPlatformVolume>(
    `
      SELECT
        day::text AS date,
        platform,
        SUM(volume_usd)::float8 AS volume_usd
      FROM daily_volume
      WHERE canonical_category = ANY($1::text[])
        AND platform = ANY($2::text[])
        AND ($3::date IS NULL OR day >= $3::date)
        AND ($4::date IS NULL OR day <= $4::date)
      GROUP BY day, platform
      ORDER BY day ASC, platform ASC
    `,
    [filters.categories, filters.platforms, window.startDate, window.endDate],
  );

  const series = result.rows.map((row) => ({
    date: row.date,
    platform: row.platform,
    volume_usd: toNumber(row.volume_usd),
  }));

  return {
    range: filters.range,
    categories: filters.categories,
    platforms: filters.platforms,
    series,
    empty: series.length === 0,
    message: series.length === 0 ? "No data found for selected filters." : null,
  };
}

export async function getCategoryShare(filters: ParsedFilters) {
  if (filters.categories.length === 0) {
    return {
      items: [],
      empty: true,
      message: EMPTY_CATEGORIES_MESSAGE,
    };
  }

  const window = resolveDateWindow(filters.range);

  const result = await pool.query<{
    category: string;
    volume_usd: number | string;
  }>(
    `
      SELECT
        canonical_category AS category,
        SUM(volume_usd)::float8 AS volume_usd
      FROM daily_volume
      WHERE canonical_category = ANY($1::text[])
        AND platform = ANY($2::text[])
        AND ($3::date IS NULL OR day >= $3::date)
        AND ($4::date IS NULL OR day <= $4::date)
      GROUP BY canonical_category
      ORDER BY SUM(volume_usd) DESC
    `,
    [filters.categories, filters.platforms, window.startDate, window.endDate],
  );

  const totalVolume = result.rows.reduce((sum, row) => sum + toNumber(row.volume_usd), 0);

  const items = result.rows.map((row) => {
    const volume = toNumber(row.volume_usd);
    const share = totalVolume > 0 ? (volume / totalVolume) * 100 : 0;

    return {
      category: row.category,
      volume_usd: Number(volume.toFixed(2)),
      share_pct: Number(share.toFixed(2)),
    };
  });

  return {
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

  const { min_day: minDay, max_day: maxDay } = bounds.rows[0] ?? { min_day: null, max_day: null };
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
      comparison: null,
      items: [],
      empty: true,
      message: EMPTY_CATEGORIES_MESSAGE,
    };
  }

  const window = await resolveDeltaWindow(filters);
  if (!window) {
    return {
      range: filters.range,
      comparison: null,
      items: [],
      empty: true,
      message: "No data available for delta calculation.",
    };
  }

  const result = await pool.query<{
    platform: Platform;
    current_volume_usd: string | number;
    previous_volume_usd: string | number;
  }>(
    `
      SELECT
        platform,
        COALESCE(SUM(CASE WHEN day BETWEEN $3::date AND $4::date THEN volume_usd END), 0)::float8 AS current_volume_usd,
        COALESCE(SUM(CASE WHEN day BETWEEN $5::date AND $6::date THEN volume_usd END), 0)::float8 AS previous_volume_usd
      FROM daily_volume
      WHERE canonical_category = ANY($1::text[])
        AND platform = ANY($2::text[])
      GROUP BY platform
      ORDER BY platform ASC
    `,
    [
      filters.categories,
      filters.platforms,
      window.currentStart,
      window.currentEnd,
      window.previousStart,
      window.previousEnd,
    ],
  );

  const items = result.rows.map((row) => {
    const current = toNumber(row.current_volume_usd);
    const previous = toNumber(row.previous_volume_usd);

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
      platform: row.platform,
      current_volume_usd: Number(current.toFixed(2)),
      previous_volume_usd: Number(previous.toFixed(2)),
      delta_pct: deltaPct === null ? null : Number(deltaPct.toFixed(2)),
      status,
    };
  });

  return {
    range: filters.range,
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
      items: [],
      empty: true,
      message: EMPTY_CATEGORIES_MESSAGE,
    };
  }

  const threshold = filters.threshold ?? 2.5;
  const window = resolveDateWindow(filters.range);
  const result = await pool.query<DayPlatformVolume>(
    `
      SELECT
        day::text AS date,
        platform,
        SUM(volume_usd)::float8 AS volume_usd
      FROM daily_volume
      WHERE canonical_category = ANY($1::text[])
        AND platform = ANY($2::text[])
        AND ($3::date IS NULL OR day >= $3::date)
        AND ($4::date IS NULL OR day <= $4::date)
      GROUP BY day, platform
      ORDER BY day ASC
    `,
    [filters.categories, filters.platforms, window.startDate, window.endDate],
  );

  const byPlatform = new Map<Platform, DayPlatformVolume[]>();
  for (const row of result.rows) {
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

  const result = await pool.query<{
    date: string;
    platform: string;
    category: string;
    volume_usd: string | number;
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
    [filters.categories, filters.platforms, window.startDate, window.endDate],
  );

  return result.rows.map((row) => ({
    date: row.date,
    platform: row.platform,
    category: row.category,
    volume_usd: Number(toNumber(row.volume_usd).toFixed(2)),
  }));
}
