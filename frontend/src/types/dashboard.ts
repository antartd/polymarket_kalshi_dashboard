export type RangePreset = "7d" | "30d" | "90d" | "all";
export type Platform = "polymarket" | "kalshi";
export type DataSource = "dune" | "live";

export const CATEGORIES = [
  "sports",
  "crypto",
  "politics",
  "geopolitics",
  "finance",
  "culture",
  "tech_science",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type DashboardFilters = {
  range: RangePreset;
  source: DataSource;
  categories: Category[];
  platforms: Platform[];
};

export type SnapshotMeta = {
  source: DataSource;
  generated_at: string | null;
  next_refresh_at: string | null;
  refresh_interval_seconds: number | null;
} | null;

export type SourceMeta = {
  requested_source: DataSource;
  served_source: DataSource;
  fallback_reason: "none" | "dune_snapshot_missing" | "live_empty_use_last_good_cache";
};

export type VolumePoint = {
  date: string;
  platform: Platform;
  volume_usd: number;
};

export type VolumeResponse = {
  range: RangePreset;
  source: DataSource;
  source_meta?: SourceMeta;
  snapshot: SnapshotMeta;
  categories: Category[];
  platforms: Platform[];
  series: VolumePoint[];
  empty: boolean;
  message: string | null;
};

export type DeltaItem = {
  platform: Platform;
  current_volume_usd: number;
  previous_volume_usd: number;
  delta_pct: number | null;
  status: "up" | "down" | "neutral" | "no_baseline";
};

export type DeltaResponse = {
  range: RangePreset;
  source: DataSource;
  source_meta?: SourceMeta;
  snapshot: SnapshotMeta;
  comparison: {
    current_start: string;
    current_end: string;
    previous_start: string;
    previous_end: string;
  } | null;
  items: DeltaItem[];
  empty: boolean;
  message: string | null;
};

export type CategoryShareResponse = {
  source: DataSource;
  source_meta?: SourceMeta;
  snapshot: SnapshotMeta;
  items: Array<{
    category: Category;
    volume_usd: number;
    share_pct: number;
    kalshi_volume_usd: number;
    polymarket_volume_usd: number;
    kalshi_share_in_category_pct: number;
    polymarket_share_in_category_pct: number;
    kalshi_share_of_total_pct: number;
    polymarket_share_of_total_pct: number;
  }>;
  empty: boolean;
  message: string | null;
};

export type AnomalyResponse = {
  threshold: number;
  source: DataSource;
  source_meta?: SourceMeta;
  snapshot: SnapshotMeta;
  items: Array<{
    date: string;
    platform: Platform;
    volume_usd: number;
    z_score: number;
  }>;
  empty: boolean;
  message: string | null;
};

export type LastUpdatedResponse = {
  source: DataSource;
  source_meta?: SourceMeta;
  snapshot: SnapshotMeta;
  latest_updated_at: string | null;
  sources: {
    daily_volume: string | null;
    daily_volume_platform_total: string | null;
    hourly_volume: string | null;
    ingestion: string | null;
  };
};
