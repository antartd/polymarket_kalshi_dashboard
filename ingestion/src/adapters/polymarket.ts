export async function fetchPolymarketTrades(_cursor: string | null) {
  return {
    source: "polymarket-api",
    nextCursor: new Date().toISOString(),
    trades: [] as Array<Record<string, unknown>>,
    markets: [] as Array<Record<string, unknown>>,
  };
}
