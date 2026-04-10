import { mapCategory } from "./category-mapper.js";

export type NormalizedMarket = {
  id: string;
  platform: "polymarket" | "kalshi";
  sourceMarketId: string;
  title: string;
  description?: string;
  rawCategory?: string;
  canonicalCategory: string;
  status?: string;
  openTime?: string;
  closeTime?: string;
  url?: string;
  metadata?: Record<string, unknown>;
};

type PolymarketMarketInput = Record<string, unknown>;
type KalshiMarketInput = Record<string, unknown>;

function readString(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }
  return value;
}

export function normalizePolymarketMarket(market: PolymarketMarketInput): NormalizedMarket | null {
  const conditionId =
    readString(market, "conditionId") ??
    readString(market, "condition_id") ??
    readString(market, "id");
  const title =
    readString(market, "question") ??
    readString(market, "title") ??
    readString(market, "name");

  if (!conditionId || !title) {
    return null;
  }

  const description = readString(market, "description");
  const rawCategory =
    readString(market, "category") ??
    readString(market, "groupItemTitle") ??
    readString(market, "groupTitle");

  const canonicalCategory = mapCategory({
    rawCategory,
    title,
    description,
  });

  return {
    id: `polymarket:${conditionId}`,
    platform: "polymarket",
    sourceMarketId: conditionId,
    title,
    description,
    rawCategory,
    canonicalCategory,
    status: readString(market, "status"),
    openTime: readString(market, "startDate") ?? readString(market, "start_date_iso"),
    closeTime: readString(market, "endDate") ?? readString(market, "end_date_iso"),
    url: readString(market, "url"),
    metadata: market,
  };
}

export function normalizeKalshiMarket(market: KalshiMarketInput): NormalizedMarket | null {
  const ticker = readString(market, "ticker");
  const title = readString(market, "title") ?? readString(market, "subtitle");

  if (!ticker || !title) {
    return null;
  }

  const description = readString(market, "subtitle");
  const rawCategory = readString(market, "event_ticker");

  return {
    id: `kalshi:${ticker}`,
    platform: "kalshi",
    sourceMarketId: ticker,
    title,
    description,
    rawCategory,
    canonicalCategory: mapCategory({ rawCategory, title, description }),
    status: readString(market, "status"),
    openTime: readString(market, "open_time"),
    closeTime: readString(market, "close_time"),
    metadata: market,
  };
}

