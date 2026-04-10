import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

type Platform = "polymarket" | "kalshi";
type Timeframe = "7d" | "30d" | "90d" | "allTime";
type ComparisonTimeframe = Exclude<Timeframe, "allTime">;
type BucketGranularity = "day" | "month";

type DuneExecutionResponse = { execution_id?: string };
type DuneExecutionStatus = {
  is_execution_finished?: boolean;
  state?: string;
  error?: { message?: string };
};
type DuneExecutionResultsPage = {
  result?: { rows?: Array<Record<string, unknown>>; next_offset?: number | null };
  rows?: Array<Record<string, unknown>>;
  next_offset?: number | null;
  error?: { message?: string };
};

type DuneBucketRow = {
  window_kind?: string;
  timeframe?: string;
  bucket_granularity?: string;
  bucket_start?: string;
  category?: string;
  volume_usd?: number | string;
  trades_count?: number | string | null;
};

type AppConfig = {
  duneApiKey: string;
  duneBaseUrl: string;
  dunePerformance: string;
  outputFile: string;
  pollIntervalMs: number;
  pollMaxAttempts: number;
  resultsPageLimit: number;
  refreshIntervalHours: number;
  requestTimeoutMs: number;
  requestRetryAttempts: number;
  requestRetryBaseMs: number;
};

type CacheSeriesPoint = {
  bucketStart: string;
  platformTotals: { polymarketUsd: number; kalshiUsd: number; combinedUsd: number };
  platformCategoryTotals: {
    polymarket: Record<string, number>;
    kalshi: Record<string, number>;
    combined: Record<string, number>;
  };
};

type CacheTimeframe = {
  bucketGranularity: BucketGranularity;
  platformTotals: { polymarketUsd: number; kalshiUsd: number; combinedUsd: number };
  platformCategoryTotals: {
    polymarket: Record<string, number>;
    kalshi: Record<string, number>;
    combined: Record<string, number>;
  };
  comparison: {
    previousPlatformTotals: { polymarketUsd: number; kalshiUsd: number; combinedUsd: number };
  } | null;
  series: CacheSeriesPoint[];
};

type CachePayload = {
  schemaVersion: number;
  generatedAt: string;
  nextRefreshAt: string;
  source: {
    provider: "Dune";
    mode: "embedded_sql";
    queryIds: null;
    executions: { polymarket: string; kalshi: string };
  };
  stats: { rowCounts: { polymarket: number; kalshi: number } };
  availableCategories: string[];
  timeframes: Record<Timeframe, CacheTimeframe>;
};

export type RefreshRunResult = {
  generatedAt: string;
  nextRefreshAt: string;
  outputFile: string;
  rowCounts: { polymarket: number; kalshi: number };
};

const TIMEFRAMES: Timeframe[] = ["7d", "30d", "90d", "allTime"];
const COMPARISON_TIMEFRAMES: ComparisonTimeframe[] = ["7d", "30d", "90d"];
const SNAPSHOT_SCHEMA_VERSION = 1;

function readNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number`);
  }
  return parsed;
}

function resolveOutputFile(): string {
  const fromEnv = process.env.OUTPUT_FILE;
  if (!fromEnv) {
    return path.resolve(process.cwd(), "..", "backend", "data", "dashboard-cache.json");
  }
  return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
}

export function getConfig(): AppConfig {
  const duneApiKey = process.env.DUNE_API_KEY ?? "";
  if (!duneApiKey) {
    throw new Error("DUNE_API_KEY is required for worker refresh-cache");
  }
  return {
    duneApiKey,
    duneBaseUrl: process.env.DUNE_BASE_URL ?? "https://api.dune.com/api/v1",
    dunePerformance: process.env.DUNE_PERFORMANCE ?? "medium",
    outputFile: resolveOutputFile(),
    pollIntervalMs: readNumberEnv("POLL_INTERVAL_MS", 2000),
    pollMaxAttempts: readNumberEnv("POLL_MAX_ATTEMPTS", 90),
    resultsPageLimit: readNumberEnv("RESULTS_PAGE_LIMIT", 5000),
    refreshIntervalHours: readNumberEnv("REFRESH_INTERVAL_HOURS", 1),
    requestTimeoutMs: readNumberEnv("REQUEST_TIMEOUT_MS", 15_000),
    requestRetryAttempts: readNumberEnv("REQUEST_RETRY_ATTEMPTS", 3),
    requestRetryBaseMs: readNumberEnv("REQUEST_RETRY_BASE_MS", 300),
  };
}

function asNum(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function normCategory(raw: unknown): string {
  const value = String(raw ?? "other").trim().toLowerCase();
  switch (value) {
    case "sports":
      return "sports";
    case "crypto":
      return "crypto";
    case "politics":
      return "politics";
    case "geopolitics":
      return "geopolitics";
    case "finance":
      return "finance";
    case "culture":
      return "culture";
    case "tech_science":
      return "tech_science";
    default:
      return "other";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitteredBackoff(baseMs: number, attempt: number): number {
  const exp = baseMs * 2 ** Math.max(0, attempt - 1);
  const jitter = Math.floor(Math.random() * Math.max(25, Math.floor(exp * 0.25)));
  return exp + jitter;
}

async function fetchJson<T>(config: AppConfig, url: string, init?: RequestInit): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= config.requestRetryAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Dune request failed ${response.status} ${response.statusText}: ${text}`);
      }
      clearTimeout(timeout);
      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (attempt >= config.requestRetryAttempts) {
        break;
      }
      await sleep(jitteredBackoff(config.requestRetryBaseMs, attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Dune request failed after retries");
}

async function executeSql(config: AppConfig, sql: string): Promise<string> {
  const payload = await fetchJson<DuneExecutionResponse>(config, `${config.duneBaseUrl}/sql/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-DUNE-API-KEY": config.duneApiKey,
    },
    body: JSON.stringify({
      sql,
      performance: config.dunePerformance,
    }),
  });
  if (!payload.execution_id) {
    throw new Error("Dune execute did not return execution_id");
  }
  return payload.execution_id;
}

async function waitForExecution(config: AppConfig, executionId: string): Promise<void> {
  for (let attempt = 0; attempt < config.pollMaxAttempts; attempt += 1) {
    const status = await fetchJson<DuneExecutionStatus>(
      config,
      `${config.duneBaseUrl}/execution/${executionId}/status`,
      { headers: { "X-DUNE-API-KEY": config.duneApiKey } },
    );
    if (status.is_execution_finished) {
      if (status.state === "QUERY_STATE_COMPLETED" || status.state === "QUERY_STATE_COMPLETED_PARTIAL") {
        return;
      }
      throw new Error(`Dune execution failed: ${status.error?.message ?? status.state ?? "unknown"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
  throw new Error(`Dune execution timeout: ${executionId}`);
}

async function getExecutionRows(config: AppConfig, executionId: string): Promise<DuneBucketRow[]> {
  const rows: DuneBucketRow[] = [];
  let offset = 0;
  while (true) {
    const url = new URL(`${config.duneBaseUrl}/execution/${executionId}/results`);
    url.searchParams.set("limit", String(config.resultsPageLimit));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("allow_partial_results", "true");
    const page = await fetchJson<DuneExecutionResultsPage>(config, url.toString(), {
      headers: { "X-DUNE-API-KEY": config.duneApiKey },
    });
    if (page.error?.message) {
      throw new Error(page.error.message);
    }
    const pageRows = (page.result?.rows ?? page.rows ?? []) as DuneBucketRow[];
    rows.push(...pageRows);
    const nextOffset = page.result?.next_offset ?? page.next_offset ?? null;
    if (nextOffset == null) break;
    offset = nextOffset;
  }
  return rows;
}

async function runSqlQuery(config: AppConfig, sql: string): Promise<{ executionId: string; rows: DuneBucketRow[] }> {
  const executionId = await executeSql(config, sql);
  await waitForExecution(config, executionId);
  const rows = await getExecutionRows(config, executionId);
  return { executionId, rows };
}

function buildPolymarketSnapshotSql(): string {
  return `
WITH bounds AS (
  SELECT CAST(current_date AS DATE) AS today_utc
),
details_dedup AS (
  SELECT
    try(from_hex(regexp_replace(replace(lower(condition_id), '0x', ''), '-', ''))) AS condition_id_bin,
    lower(coalesce(arbitrary(tags), '')) AS tags
  FROM polymarket_polygon.market_details
  GROUP BY 1
),
base AS (
  SELECT
    CAST(date_trunc('day', t.block_time) AS DATE) AS bucket_day,
    CASE
      WHEN regexp_like(d.tags, 'sports|soccer|football|basketball|tennis|baseball|mma|ufc|golf|esports') THEN 'sports'
      WHEN regexp_like(d.tags, 'crypto|bitcoin|ethereum|solana|defi|xrp') THEN 'crypto'
      WHEN regexp_like(d.tags, 'politics|elections|trump|biden|congress') THEN 'politics'
      WHEN regexp_like(d.tags, 'world|geopolitics|ukraine|russia|china|iran|israel|war') THEN 'geopolitics'
      WHEN regexp_like(d.tags, 'finance|business|economy|fed|inflation|stocks|earnings|macro') THEN 'finance'
      WHEN regexp_like(d.tags, 'technology|tech|science|ai|climate|space') THEN 'tech_science'
      WHEN regexp_like(d.tags, 'culture|music|awards|movies|entertainment|celebrity') THEN 'culture'
      ELSE 'other'
    END AS category,
    SUM(t.amount) AS volume_usd,
    COUNT(*) AS trades_count
  FROM polymarket_polygon.market_trades t
  LEFT JOIN details_dedup d
    ON t.condition_id = d.condition_id_bin
  CROSS JOIN bounds b
  WHERE t.action = 'CLOB trade'
    AND t.block_time >= CAST(b.today_utc - INTERVAL '180' DAY AS TIMESTAMP)
    AND t.block_time < CAST(b.today_utc AS TIMESTAMP)
  GROUP BY 1, 2
),
daily AS (
  SELECT
    'day' AS bucket_granularity,
    bucket_day AS bucket_start,
    category,
    SUM(volume_usd) AS volume_usd,
    SUM(trades_count) AS trades_count
  FROM base
  GROUP BY 1, 2, 3
),
monthly AS (
  SELECT
    'month' AS bucket_granularity,
    CAST(date_trunc('month', bucket_day) AS DATE) AS bucket_start,
    category,
    SUM(volume_usd) AS volume_usd,
    SUM(trades_count) AS trades_count
  FROM base
  GROUP BY 1, 2, 3
),
rolled AS (
  SELECT * FROM daily
  UNION ALL
  SELECT * FROM monthly
)
SELECT 'current' AS window_kind, '7d' AS timeframe, 'day' AS bucket_granularity, bucket_start, category, volume_usd, trades_count
FROM rolled CROSS JOIN bounds b
WHERE bucket_granularity = 'day' AND bucket_start >= b.today_utc - INTERVAL '7' DAY AND bucket_start < b.today_utc
UNION ALL
SELECT 'current', '30d', 'day', bucket_start, category, volume_usd, trades_count
FROM rolled CROSS JOIN bounds b
WHERE bucket_granularity = 'day' AND bucket_start >= b.today_utc - INTERVAL '30' DAY AND bucket_start < b.today_utc
UNION ALL
SELECT 'current', '90d', 'day', bucket_start, category, volume_usd, trades_count
FROM rolled CROSS JOIN bounds b
WHERE bucket_granularity = 'day' AND bucket_start >= b.today_utc - INTERVAL '90' DAY AND bucket_start < b.today_utc
UNION ALL
SELECT 'current', 'allTime', 'month', bucket_start, category, volume_usd, trades_count
FROM rolled
WHERE bucket_granularity = 'month'
UNION ALL
SELECT 'previous', '7d', 'day', bucket_start, category, volume_usd, trades_count
FROM rolled CROSS JOIN bounds b
WHERE bucket_granularity = 'day' AND bucket_start >= b.today_utc - INTERVAL '14' DAY AND bucket_start < b.today_utc - INTERVAL '7' DAY
UNION ALL
SELECT 'previous', '30d', 'day', bucket_start, category, volume_usd, trades_count
FROM rolled CROSS JOIN bounds b
WHERE bucket_granularity = 'day' AND bucket_start >= b.today_utc - INTERVAL '60' DAY AND bucket_start < b.today_utc - INTERVAL '30' DAY
UNION ALL
SELECT 'previous', '90d', 'day', bucket_start, category, volume_usd, trades_count
FROM rolled CROSS JOIN bounds b
WHERE bucket_granularity = 'day' AND bucket_start >= b.today_utc - INTERVAL '180' DAY AND bucket_start < b.today_utc - INTERVAL '90' DAY
ORDER BY 1, 2, 4, 5
`.trim();
}

function buildKalshiSnapshotSql(): string {
  return `
WITH bounds AS (
  SELECT CAST(current_date AS DATE) AS today_utc
),
daily_canonical AS (
  SELECT
    CAST(date AS DATE) AS day,
    CASE
      WHEN lower(trim(category)) = 'sports' THEN 'sports'
      WHEN lower(trim(category)) = 'crypto' THEN 'crypto'
      WHEN lower(trim(category)) IN ('politics', 'elections') THEN 'politics'
      WHEN lower(trim(category)) = 'world' THEN 'geopolitics'
      WHEN lower(trim(category)) IN ('economics', 'financials', 'companies') THEN 'finance'
      WHEN lower(trim(category)) IN ('science and technology', 'climate and weather', 'health', 'education', 'transportation') THEN 'tech_science'
      WHEN lower(trim(category)) IN ('entertainment', 'social', 'mentions') THEN 'culture'
      ELSE 'other'
    END AS category,
    SUM(daily_volume) AS volume_usd
  FROM kalshi.market_report
  GROUP BY 1, 2
),
monthly_canonical AS (
  SELECT
    CAST(date_trunc('month', day) AS DATE) AS bucket_start,
    category,
    SUM(volume_usd) AS volume_usd
  FROM daily_canonical
  GROUP BY 1, 2
)
SELECT 'current' AS window_kind, '7d' AS timeframe, 'day' AS bucket_granularity, day AS bucket_start, category, volume_usd, CAST(NULL AS BIGINT) AS trades_count
FROM daily_canonical CROSS JOIN bounds b
WHERE day >= b.today_utc - INTERVAL '7' DAY AND day < b.today_utc
UNION ALL
SELECT 'current', '30d', 'day', day, category, volume_usd, CAST(NULL AS BIGINT)
FROM daily_canonical CROSS JOIN bounds b
WHERE day >= b.today_utc - INTERVAL '30' DAY AND day < b.today_utc
UNION ALL
SELECT 'current', '90d', 'day', day, category, volume_usd, CAST(NULL AS BIGINT)
FROM daily_canonical CROSS JOIN bounds b
WHERE day >= b.today_utc - INTERVAL '90' DAY AND day < b.today_utc
UNION ALL
SELECT 'current', 'allTime', 'month', bucket_start, category, volume_usd, CAST(NULL AS BIGINT)
FROM monthly_canonical
UNION ALL
SELECT 'previous', '7d', 'day', day, category, volume_usd, CAST(NULL AS BIGINT)
FROM daily_canonical CROSS JOIN bounds b
WHERE day >= b.today_utc - INTERVAL '14' DAY AND day < b.today_utc - INTERVAL '7' DAY
UNION ALL
SELECT 'previous', '30d', 'day', day, category, volume_usd, CAST(NULL AS BIGINT)
FROM daily_canonical CROSS JOIN bounds b
WHERE day >= b.today_utc - INTERVAL '60' DAY AND day < b.today_utc - INTERVAL '30' DAY
UNION ALL
SELECT 'previous', '90d', 'day', day, category, volume_usd, CAST(NULL AS BIGINT)
FROM daily_canonical CROSS JOIN bounds b
WHERE day >= b.today_utc - INTERVAL '180' DAY AND day < b.today_utc - INTERVAL '90' DAY
ORDER BY 1, 2, 4, 5
`.trim();
}

function aggregatePlatformRows(rows: DuneBucketRow[]): Record<Timeframe, {
  bucketGranularity: BucketGranularity;
  total: number;
  categoryTotals: Record<string, number>;
  series: Array<{ bucketStart: string; total: number; categoryTotals: Record<string, number> }>;
}> {
  const byTimeframe = new Map<Timeframe, {
    bucketGranularity: BucketGranularity;
    categories: Map<string, number>;
    buckets: Map<string, { total: number; categories: Map<string, number> }>;
  }>();

  for (const row of rows) {
    const timeframe = String(row.timeframe) as Timeframe;
    const bucketGranularity = String(row.bucket_granularity) as BucketGranularity;
    const bucketStart = String(row.bucket_start ?? "").slice(0, 10);
    if (!TIMEFRAMES.includes(timeframe) || (bucketGranularity !== "day" && bucketGranularity !== "month") || !bucketStart) {
      continue;
    }
    const category = normCategory(row.category);
    const volume = asNum(row.volume_usd);

    const frame = byTimeframe.get(timeframe) ?? {
      bucketGranularity,
      categories: new Map<string, number>(),
      buckets: new Map<string, { total: number; categories: Map<string, number> }>(),
    };
    frame.bucketGranularity = bucketGranularity;
    frame.categories.set(category, (frame.categories.get(category) ?? 0) + volume);
    const bucket = frame.buckets.get(bucketStart) ?? { total: 0, categories: new Map<string, number>() };
    bucket.total += volume;
    bucket.categories.set(category, (bucket.categories.get(category) ?? 0) + volume);
    frame.buckets.set(bucketStart, bucket);
    byTimeframe.set(timeframe, frame);
  }

  const out = {} as Record<Timeframe, {
    bucketGranularity: BucketGranularity;
    total: number;
    categoryTotals: Record<string, number>;
    series: Array<{ bucketStart: string; total: number; categoryTotals: Record<string, number> }>;
  }>;

  for (const timeframe of TIMEFRAMES) {
    const frame = byTimeframe.get(timeframe) ?? {
      bucketGranularity: timeframe === "allTime" ? "month" : "day",
      categories: new Map<string, number>(),
      buckets: new Map<string, { total: number; categories: Map<string, number> }>(),
    };
    const categoryTotals = Object.fromEntries(
      [...frame.categories.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => [k, Math.round(v)]),
    );
    const series = [...frame.buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([bucketStart, bucket]) => ({
        bucketStart,
        total: Math.round(bucket.total),
        categoryTotals: Object.fromEntries(
          [...bucket.categories.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => [k, Math.round(v)]),
        ),
      }));
    out[timeframe] = {
      bucketGranularity: frame.bucketGranularity,
      total: Object.values(categoryTotals).reduce((sum, n) => sum + asNum(n), 0),
      categoryTotals,
      series,
    };
  }
  return out;
}

function previousTotals(rows: DuneBucketRow[]): Record<ComparisonTimeframe, number> {
  const totals: Record<ComparisonTimeframe, number> = { "7d": 0, "30d": 0, "90d": 0 };
  for (const row of rows) {
    const timeframe = String(row.timeframe) as ComparisonTimeframe;
    if (!COMPARISON_TIMEFRAMES.includes(timeframe)) continue;
    totals[timeframe] += asNum(row.volume_usd);
  }
  return totals;
}

function combineCategories(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const m = new Map<string, number>();
  for (const [k, v] of Object.entries(a)) m.set(k, (m.get(k) ?? 0) + asNum(v));
  for (const [k, v] of Object.entries(b)) m.set(k, (m.get(k) ?? 0) + asNum(v));
  return Object.fromEntries([...m.entries()].sort((x, y) => x[0].localeCompare(y[0])));
}

function buildPayload(
  polymarketExecutionId: string,
  polymarketRows: DuneBucketRow[],
  kalshiExecutionId: string,
  kalshiRows: DuneBucketRow[],
  refreshIntervalHours: number,
): CachePayload {
  const split = (rows: DuneBucketRow[]) => ({
    current: rows.filter((r) => String(r.window_kind) === "current"),
    previous: rows.filter((r) => String(r.window_kind) === "previous"),
  });
  const p = split(polymarketRows);
  const k = split(kalshiRows);
  const pFrames = aggregatePlatformRows(p.current);
  const kFrames = aggregatePlatformRows(k.current);
  const pPrev = previousTotals(p.previous);
  const kPrev = previousTotals(k.previous);

  const timeframes = {} as Record<Timeframe, CacheTimeframe>;
  for (const timeframe of TIMEFRAMES) {
    const pFrame = pFrames[timeframe];
    const kFrame = kFrames[timeframe];
    const allBucketStarts = new Set([...pFrame.series.map((s) => s.bucketStart), ...kFrame.series.map((s) => s.bucketStart)]);
    const pByBucket = new Map(pFrame.series.map((s) => [s.bucketStart, s]));
    const kByBucket = new Map(kFrame.series.map((s) => [s.bucketStart, s]));
    const series: CacheSeriesPoint[] = [...allBucketStarts].sort((a, b) => a.localeCompare(b)).map((bucketStart) => {
      const pb = pByBucket.get(bucketStart);
      const kb = kByBucket.get(bucketStart);
      const pTotal = pb?.total ?? 0;
      const kTotal = kb?.total ?? 0;
      const pCats = pb?.categoryTotals ?? {};
      const kCats = kb?.categoryTotals ?? {};
      return {
        bucketStart,
        platformTotals: {
          polymarketUsd: pTotal,
          kalshiUsd: kTotal,
          combinedUsd: pTotal + kTotal,
        },
        platformCategoryTotals: {
          polymarket: pCats,
          kalshi: kCats,
          combined: combineCategories(pCats, kCats),
        },
      };
    });

    timeframes[timeframe] = {
      bucketGranularity: pFrame.bucketGranularity,
      platformTotals: {
        polymarketUsd: pFrame.total,
        kalshiUsd: kFrame.total,
        combinedUsd: pFrame.total + kFrame.total,
      },
      platformCategoryTotals: {
        polymarket: pFrame.categoryTotals,
        kalshi: kFrame.categoryTotals,
        combined: combineCategories(pFrame.categoryTotals, kFrame.categoryTotals),
      },
      comparison:
        timeframe === "allTime"
          ? null
          : {
              previousPlatformTotals: {
                polymarketUsd: Math.round(pPrev[timeframe]),
                kalshiUsd: Math.round(kPrev[timeframe]),
                combinedUsd: Math.round(pPrev[timeframe] + kPrev[timeframe]),
              },
            },
      series,
    };
  }

  const generatedAt = new Date();
  const nextRefreshAt = new Date(generatedAt.getTime() + refreshIntervalHours * 60 * 60 * 1000);
  const availableCategories = new Set<string>();
  for (const timeframe of TIMEFRAMES) {
    for (const category of Object.keys(timeframes[timeframe].platformCategoryTotals.combined)) {
      availableCategories.add(category);
    }
  }

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    generatedAt: generatedAt.toISOString(),
    nextRefreshAt: nextRefreshAt.toISOString(),
    source: {
      provider: "Dune",
      mode: "embedded_sql",
      queryIds: null,
      executions: {
        polymarket: polymarketExecutionId,
        kalshi: kalshiExecutionId,
      },
    },
    stats: {
      rowCounts: {
        polymarket: polymarketRows.length,
        kalshi: kalshiRows.length,
      },
    },
    availableCategories: [...availableCategories].sort((a, b) => a.localeCompare(b)),
    timeframes,
  };
}

export async function refreshDashboardCache(config: AppConfig = getConfig()): Promise<RefreshRunResult> {
  const polymarketSql = buildPolymarketSnapshotSql();
  const kalshiSql = buildKalshiSnapshotSql();

  const polymarketResult = await runSqlQuery(config, polymarketSql);
  const kalshiResult = await runSqlQuery(config, kalshiSql);

  const payload = buildPayload(
    polymarketResult.executionId,
    polymarketResult.rows,
    kalshiResult.executionId,
    kalshiResult.rows,
    config.refreshIntervalHours,
  );

  mkdirSync(path.dirname(config.outputFile), { recursive: true });
  writeFileSync(config.outputFile, JSON.stringify(payload, null, 2));

  return {
    generatedAt: payload.generatedAt,
    nextRefreshAt: payload.nextRefreshAt,
    outputFile: config.outputFile,
    rowCounts: {
      polymarket: polymarketResult.rows.length,
      kalshi: kalshiResult.rows.length,
    },
  };
}

async function main(): Promise<void> {
  await refreshDashboardCache();
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (isDirectExecution()) {
  void main();
}
