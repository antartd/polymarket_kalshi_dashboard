import { config } from "../config.js";

type GraphResponse = {
  data?: {
    markets?: Array<Record<string, unknown>>;
  };
};

const DEFAULT_LIMIT = 500;

export async function fetchPolymarketGraphFallback(cursor: string | null) {
  const query = `
    query FallbackMarkets($first: Int!) {
      markets(first: $first) {
        id
        question
      }
    }
  `;

  const response = await fetch(config.polymarketGraphUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      query,
      variables: {
        first: DEFAULT_LIMIT,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Polymarket graph fallback failed (${response.status})`);
  }

  const payload = (await response.json()) as GraphResponse;
  const markets = payload.data?.markets ?? [];

  return {
    source: "polymarket-graph" as const,
    nextCursor: String(Math.floor(Date.now() / 1000)),
    trades: [] as Array<Record<string, unknown>>,
    markets,
  };
}
