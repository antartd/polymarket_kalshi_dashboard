export async function fetchPolymarketGraphFallback(_cursor: string | null) {
  return {
    source: "polymarket-graph",
    nextCursor: new Date().toISOString(),
    trades: [] as Array<Record<string, unknown>>,
    markets: [] as Array<Record<string, unknown>>,
  };
}
