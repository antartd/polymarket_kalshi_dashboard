import { env } from "../config/env.js";

type DuneResponse = {
  execution_ended_at?: string;
  execution_started_at?: string;
  submitted_at?: string;
  next_offset?: number | null;
  result?: {
    rows?: Array<Record<string, unknown>>;
  };
};

export type DuneDailyRow = {
  date: string;
  platform: "polymarket" | "kalshi";
  category: string;
  volume_usd: number;
};

export type DuneSnapshotMeta = {
  generated_at: string | null;
  next_refresh_at: string | null;
  refresh_interval_seconds: number;
};

function readDate(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") {
    const short = value.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(short)) {
      return short;
    }
  }
  return null;
}

function readPlatform(value: unknown): "polymarket" | "kalshi" | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "polymarket" || normalized === "kalshi") {
    return normalized;
  }
  return null;
}

function readCategory(row: Record<string, unknown>): string | null {
  const value = row.category ?? row.canonical_category;
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim().toLowerCase();
  }
  return null;
}

function readVolume(row: Record<string, unknown>): number | null {
  const value = row.volume_usd ?? row.volume;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function canUseDune(): boolean {
  return env.duneApiKey.trim() !== "" && env.duneQueryId.trim() !== "";
}

function asIsoOrNull(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function nextHourIso(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  parsed.setUTCMinutes(0, 0, 0);
  parsed.setUTCHours(parsed.getUTCHours() + 1);
  return parsed.toISOString();
}

function normalizeDuneRows(
  allRows: Array<Record<string, unknown>>,
  startDate: string,
  endDate: string,
  categories: string[],
  platforms: Array<"polymarket" | "kalshi">,
): DuneDailyRow[] {
  const normalized: DuneDailyRow[] = [];
  for (const row of allRows) {
    const date = readDate(row.date ?? row.day ?? row.block_date);
    const platform = readPlatform(row.platform);
    const category = readCategory(row);
    const volume = readVolume(row);

    if (!date || !platform || !category || volume === null) {
      continue;
    }
    if (date < startDate || date > endDate) {
      continue;
    }
    if (!categories.includes(category)) {
      continue;
    }
    if (!platforms.includes(platform)) {
      continue;
    }

    normalized.push({
      date,
      platform,
      category,
      volume_usd: volume,
    });
  }

  return normalized;
}

export async function fetchDuneDailyRows(
  startDate: string,
  endDate: string,
  categories: string[],
  platforms: Array<"polymarket" | "kalshi">,
): Promise<DuneDailyRow[]> {
  if (!canUseDune()) {
    return [];
  }

  const allRows: Array<Record<string, unknown>> = [];
  const limit = 1000;
  let offset = 0;
  const maxPages = 20;

  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL(`https://api.dune.com/api/v1/query/${env.duneQueryId}/results`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("allow_partial_results", "true");

    const response = await fetch(url.toString(), {
      headers: {
        "X-DUNE-API-KEY": env.duneApiKey,
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Dune request failed (${response.status})`);
    }

    const payload = (await response.json()) as DuneResponse;
    const rows = payload.result?.rows ?? [];
    if (rows.length === 0) {
      break;
    }
    allRows.push(...rows);

    const nextOffset = payload.next_offset;
    if (typeof nextOffset !== "number" || nextOffset <= offset) {
      break;
    }
    offset = nextOffset;
  }

  return normalizeDuneRows(allRows, startDate, endDate, categories, platforms);
}

export async function fetchDuneDailyRowsWithSnapshotMeta(
  startDate: string,
  endDate: string,
  categories: string[],
  platforms: Array<"polymarket" | "kalshi">,
): Promise<{ rows: DuneDailyRow[]; snapshot: DuneSnapshotMeta | null }> {
  if (!canUseDune()) {
    return { rows: [], snapshot: null };
  }

  const allRows: Array<Record<string, unknown>> = [];
  const limit = 1000;
  let offset = 0;
  const maxPages = 20;
  let generatedAt: string | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL(`https://api.dune.com/api/v1/query/${env.duneQueryId}/results`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("allow_partial_results", "true");

    const response = await fetch(url.toString(), {
      headers: {
        "X-DUNE-API-KEY": env.duneApiKey,
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Dune request failed (${response.status})`);
    }

    const payload = (await response.json()) as DuneResponse;
    if (!generatedAt) {
      generatedAt =
        asIsoOrNull(payload.execution_ended_at) ??
        asIsoOrNull(payload.execution_started_at) ??
        asIsoOrNull(payload.submitted_at);
    }
    const rows = payload.result?.rows ?? [];
    if (rows.length === 0) {
      break;
    }
    allRows.push(...rows);

    const nextOffset = payload.next_offset;
    if (typeof nextOffset !== "number" || nextOffset <= offset) {
      break;
    }
    offset = nextOffset;
  }

  return {
    rows: normalizeDuneRows(allRows, startDate, endDate, categories, platforms),
    snapshot: {
      generated_at: generatedAt,
      next_refresh_at: nextHourIso(generatedAt),
      refresh_interval_seconds: 3600,
    },
  };
}
