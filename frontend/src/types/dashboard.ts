export type RangePreset = "7d" | "30d" | "90d" | "all";
export type Platform = "polymarket" | "kalshi";

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
  categories: Category[];
  platforms: Platform[];
};

export type VolumePoint = {
  date: string;
  platform: Platform;
  volume_usd: number;
};

export type VolumeResponse = {
  range: RangePreset;
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
  items: Array<{
    category: Category;
    volume_usd: number;
    share_pct: number;
  }>;
  empty: boolean;
  message: string | null;
};

export type AnomalyResponse = {
  threshold: number;
  items: Array<{
    date: string;
    platform: Platform;
    volume_usd: number;
    z_score: number;
  }>;
  empty: boolean;
  message: string | null;
};
