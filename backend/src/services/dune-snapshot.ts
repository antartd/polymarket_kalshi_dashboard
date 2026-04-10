import { readFile } from "fs/promises";
import { env } from "../config/env.js";
import type { Platform, RangePreset } from "../config/constants.js";

type SnapshotPlatform = "polymarket" | "kalshi";
type SnapshotTimeframe = "7d" | "30d" | "90d" | "allTime";

type SnapshotSeriesPoint = {
  bucketStart: string;
  platformCategoryTotals: {
    polymarket: Record<string, number>;
    kalshi: Record<string, number>;
    combined: Record<string, number>;
  };
};

type SnapshotComparison = {
  previousPlatformTotals: {
    polymarketUsd: number;
    kalshiUsd: number;
    combinedUsd: number;
  };
};

type SnapshotTimeframeData = {
  platformTotals: {
    polymarketUsd: number;
    kalshiUsd: number;
    combinedUsd: number;
  };
  comparison: SnapshotComparison | null;
  series: SnapshotSeriesPoint[];
};

type DuneSnapshotPayload = {
  schemaVersion?: number;
  generatedAt: string;
  nextRefreshAt: string;
  source: {
    provider: "Dune";
    mode: "embedded_sql";
    queryIds: null;
    executions: {
      polymarket: string;
      kalshi: string;
    };
  };
  stats: {
    rowCounts: {
      polymarket: number;
      kalshi: number;
    };
  };
  availableCategories: string[];
  timeframes: Record<SnapshotTimeframe, SnapshotTimeframeData>;
};

const EXPECTED_SNAPSHOT_SCHEMA_VERSION = 1;

export type SnapshotMeta = {
  source: "dune";
  generated_at: string | null;
  next_refresh_at: string | null;
  refresh_interval_seconds: number;
};

export type SnapshotDailyCategoryRow = {
  date: string;
  platform: Platform;
  category: string;
  volume_usd: number;
};

function toSnapshotTimeframe(range: RangePreset): SnapshotTimeframe {
  if (range === "all") {
    return "allTime";
  }
  return range;
}

function readPlatformCategoryTotals(
  point: SnapshotSeriesPoint,
  platform: SnapshotPlatform,
): Record<string, number> {
  return point.platformCategoryTotals[platform] ?? {};
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

async function readSnapshotPayload(): Promise<DuneSnapshotPayload | null> {
  try {
    const raw = await readFile(env.duneSnapshotFile, "utf8");
    const parsed = JSON.parse(raw) as DuneSnapshotPayload;
    const schemaVersion = parsed.schemaVersion ?? 0;
    const isLegacyV0 = schemaVersion === 0;
    if (schemaVersion !== EXPECTED_SNAPSHOT_SCHEMA_VERSION && !isLegacyV0) {
      console.error(
        `Snapshot schema version mismatch: expected=${EXPECTED_SNAPSHOT_SCHEMA_VERSION}, got=${schemaVersion}`,
      );
      return null;
    }
    if (isLegacyV0) {
      console.warn(
        "Snapshot schema version is missing (legacy v0). Accepting for backward compatibility.",
      );
    }
    if (!parsed.timeframes || !parsed.source || parsed.source.mode !== "embedded_sql") {
      console.error("Snapshot schema validation failed: required fields are missing");
      return null;
    }
    return parsed;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      return null;
    }
    console.error("Failed to read Dune snapshot file", error);
    return null;
  }
}

export async function getDuneSnapshotMeta(): Promise<SnapshotMeta | null> {
  const snapshot = await readSnapshotPayload();
  if (!snapshot) {
    return null;
  }
  return {
    source: "dune",
    generated_at: snapshot.generatedAt ?? null,
    next_refresh_at: snapshot.nextRefreshAt ?? null,
    refresh_interval_seconds: 3600,
  };
}

export async function getDuneSnapshotRows(
  range: RangePreset,
  categories: string[],
  platforms: Platform[],
): Promise<{ rows: SnapshotDailyCategoryRow[]; snapshot: SnapshotMeta | null }> {
  const snapshot = await readSnapshotPayload();
  if (!snapshot) {
    return {
      rows: [],
      snapshot: null,
    };
  }

  const timeframe = snapshot.timeframes[toSnapshotTimeframe(range)];
  if (!timeframe) {
    return {
      rows: [],
      snapshot: {
        source: "dune",
        generated_at: snapshot.generatedAt ?? null,
        next_refresh_at: snapshot.nextRefreshAt ?? null,
        refresh_interval_seconds: 3600,
      },
    };
  }

  const categorySet = new Set(categories);
  const rows: SnapshotDailyCategoryRow[] = [];
  for (const point of timeframe.series ?? []) {
    for (const platform of platforms) {
      const totals = readPlatformCategoryTotals(point, platform);
      for (const [category, volume] of Object.entries(totals)) {
        if (!categorySet.has(category)) {
          continue;
        }
        rows.push({
          date: String(point.bucketStart).slice(0, 10),
          platform,
          category,
          volume_usd: asNumber(volume),
        });
      }
    }
  }

  return {
    rows,
    snapshot: {
      source: "dune",
      generated_at: snapshot.generatedAt ?? null,
      next_refresh_at: snapshot.nextRefreshAt ?? null,
      refresh_interval_seconds: 3600,
    },
  };
}

export async function getDuneSnapshotDeltaTotals(
  range: Exclude<RangePreset, "all">,
): Promise<{
  current: { polymarket: number; kalshi: number };
  previous: { polymarket: number; kalshi: number } | null;
  snapshot: SnapshotMeta | null;
}> {
  const snapshot = await readSnapshotPayload();
  if (!snapshot) {
    return {
      current: { polymarket: 0, kalshi: 0 },
      previous: null,
      snapshot: null,
    };
  }

  const timeframe = snapshot.timeframes[range];
  const previous = timeframe?.comparison?.previousPlatformTotals ?? null;

  return {
    current: {
      polymarket: asNumber(timeframe?.platformTotals?.polymarketUsd),
      kalshi: asNumber(timeframe?.platformTotals?.kalshiUsd),
    },
    previous: previous
      ? {
          polymarket: asNumber(previous.polymarketUsd),
          kalshi: asNumber(previous.kalshiUsd),
        }
      : null,
    snapshot: {
      source: "dune",
      generated_at: snapshot.generatedAt ?? null,
      next_refresh_at: snapshot.nextRefreshAt ?? null,
      refresh_interval_seconds: 3600,
    },
  };
}
