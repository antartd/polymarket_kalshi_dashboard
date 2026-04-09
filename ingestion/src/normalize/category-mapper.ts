const CANONICAL = [
  "sports",
  "crypto",
  "politics",
  "geopolitics",
  "finance",
  "culture",
  "tech_science",
  "other",
] as const;

export type CanonicalCategory = (typeof CANONICAL)[number];

const keywordRules: Array<{ pattern: RegExp; category: CanonicalCategory }> = [
  { pattern: /sport|nba|nfl|mlb|soccer|fifa|tennis/i, category: "sports" },
  { pattern: /bitcoin|crypto|eth|solana|token|blockchain/i, category: "crypto" },
  { pattern: /election|president|senate|congress|vote/i, category: "politics" },
  { pattern: /war|nato|ukraine|china|taiwan|middle east/i, category: "geopolitics" },
  { pattern: /fed|rate|inflation|economy|stocks|finance/i, category: "finance" },
  { pattern: /movie|music|award|culture|tv/i, category: "culture" },
  { pattern: /ai|science|tech|spacex|nasa|quantum/i, category: "tech_science" },
];

export function mapCategory(input: {
  rawCategory?: string | null;
  title?: string | null;
  description?: string | null;
}): CanonicalCategory {
  const raw = (input.rawCategory ?? "").toLowerCase().trim();
  if (CANONICAL.includes(raw as CanonicalCategory)) {
    return raw as CanonicalCategory;
  }

  const text = `${input.rawCategory ?? ""} ${input.title ?? ""} ${input.description ?? ""}`;

  for (const rule of keywordRules) {
    if (rule.pattern.test(text)) {
      return rule.category;
    }
  }

  return "other";
}
