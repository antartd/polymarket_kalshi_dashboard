export type NormalizedTrade = {
  id: string;
  platform: "polymarket" | "kalshi";
  sourceTradeId: string;
  marketId: string;
  tradeTs: string;
  price?: string;
  size?: string;
  volumeUsd: string;
  side?: string;
  outcome?: string;
  metadata?: Record<string, unknown>;
};

function readString(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }
  return value;
}

function readNumber(obj: Record<string, unknown>, key: string): number | null {
  const value = obj[key];
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

export function normalizePolymarketTrade(trade: Record<string, unknown>): NormalizedTrade | null {
  const conditionId = readString(trade, "conditionId");
  if (!conditionId) {
    return null;
  }

  const timestampValue = readNumber(trade, "timestamp");
  const timestampMs =
    timestampValue === null
      ? Date.now()
      : timestampValue > 1_000_000_000_000
        ? timestampValue
        : timestampValue * 1000;
  const tradeTs = new Date(timestampMs).toISOString();

  const sizeNum = readNumber(trade, "size") ?? 0;
  const priceNum = readNumber(trade, "price") ?? 0;
  const volumeUsd = sizeNum * priceNum;

  const txHash = readString(trade, "transactionHash") ?? "unknown_tx";
  const sourceTradeId = `${txHash}:${conditionId}:${timestampValue ?? "now"}`;

  return {
    id: `polymarket:${sourceTradeId}`,
    platform: "polymarket",
    sourceTradeId,
    marketId: `polymarket:${conditionId}`,
    tradeTs,
    price: priceNum.toString(),
    size: sizeNum.toString(),
    volumeUsd: volumeUsd.toString(),
    side: readString(trade, "side"),
    outcome: readString(trade, "outcome"),
    metadata: trade,
  };
}

export function normalizeKalshiTrade(trade: Record<string, unknown>): NormalizedTrade | null {
  const tradeId = readString(trade, "trade_id");
  const ticker = readString(trade, "ticker");
  const createdTime = readString(trade, "created_time");

  if (!tradeId || !ticker || !createdTime) {
    return null;
  }

  const count = readNumber(trade, "count_fp") ?? 0;
  const yesPrice = readNumber(trade, "yes_price_dollars") ?? 0;
  const noPrice = readNumber(trade, "no_price_dollars") ?? 0;
  const takerSide = readString(trade, "taker_side")?.toLowerCase();
  const price = takerSide === "no" ? noPrice : yesPrice;
  const volumeUsd = count * price;

  return {
    id: `kalshi:${tradeId}`,
    platform: "kalshi",
    sourceTradeId: tradeId,
    marketId: `kalshi:${ticker}`,
    tradeTs: createdTime,
    price: price.toString(),
    size: count.toString(),
    volumeUsd: volumeUsd.toString(),
    side: takerSide,
    metadata: trade,
  };
}
