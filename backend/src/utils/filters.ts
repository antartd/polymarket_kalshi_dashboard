import { z } from "zod";
import {
  CATEGORIES,
  DATA_SOURCES,
  PLATFORMS,
  RANGE_PRESETS,
  type CanonicalCategory,
  type DataSource,
  type Platform,
  type RangePreset,
} from "../config/constants.js";
import { HttpError } from "./errors.js";

const querySchema = z.object({
  range: z.enum(RANGE_PRESETS).optional().default("30d"),
  source: z.enum(DATA_SOURCES).optional().default("dune"),
  categories: z.string().optional(),
  platforms: z.string().optional(),
  threshold: z.coerce.number().min(0).max(10).optional(),
});

function parseCsvParam(rawValue: string | undefined): string[] | undefined {
  if (rawValue === undefined) {
    return undefined;
  }

  if (rawValue.trim() === "") {
    return [];
  }

  return rawValue
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export type ParsedFilters = {
  range: RangePreset;
  source: DataSource;
  categories: CanonicalCategory[];
  platforms: Platform[];
  threshold?: number;
};

export function parseFilters(query: unknown): ParsedFilters {
  const parsed = querySchema.safeParse(query);

  if (!parsed.success) {
    throw new HttpError(400, "Invalid query parameters", parsed.error.flatten());
  }

  const categoryList = parseCsvParam(parsed.data.categories);
  const platformList = parseCsvParam(parsed.data.platforms);

  const categories = categoryList ?? [...CATEGORIES];
  const platforms = platformList ?? [...PLATFORMS];

  const invalidCategory = categories.find((item) => !CATEGORIES.includes(item as CanonicalCategory));
  if (invalidCategory) {
    throw new HttpError(400, `Invalid category: ${invalidCategory}`);
  }

  const invalidPlatform = platforms.find((item) => !PLATFORMS.includes(item as Platform));
  if (invalidPlatform) {
    throw new HttpError(400, `Invalid platform: ${invalidPlatform}`);
  }

  return {
    range: parsed.data.range,
    source: parsed.data.source,
    categories: categories as CanonicalCategory[],
    platforms: platforms as Platform[],
    threshold: parsed.data.threshold,
  };
}
