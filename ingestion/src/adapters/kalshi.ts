export async function fetchKalshiTrades(_cursor: string | null) {
  return {
    source: "kalshi-api",
    nextCursor: new Date().toISOString(),
    trades: [] as Array<Record<string, unknown>>,
    markets: [] as Array<Record<string, unknown>>,
  };
}
