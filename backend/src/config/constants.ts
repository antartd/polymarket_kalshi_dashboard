export const RANGE_PRESETS = ["7d", "30d", "90d", "all"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const PLATFORMS = ["polymarket", "kalshi"] as const;
export type Platform = (typeof PLATFORMS)[number];

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
export type CanonicalCategory = (typeof CATEGORIES)[number];

export const RANGE_DAYS: Record<Exclude<RangePreset, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export const EMPTY_CATEGORIES_MESSAGE =
  "Select at least one category to display volume data.";
