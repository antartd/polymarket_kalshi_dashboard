import { config } from "../config.js";

const DEFAULT_LIMIT = 500;
const DEFAULT_BOOTSTRAP_DAYS = 90;
const DEFAULT_MAX_TRADE_PAGES = 10;

type PaginatedResponse = {
  cursor?: string;
  trades?: Array<Record<string, unknown>>;
  markets?: Array<Record<string, unknown>>;
};

type FetchKalshiTradesOptions = {
  paginationCursor?: string | null;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Kalshi request failed (${response.status}): ${url}`);
  }
  return (await response.json()) as T;
}

export async function fetchKalshiTrades(
  cursor: string | null,
  options: FetchKalshiTradesOptions = {},
) {
  const marketsUrl = new URL("markets", `${config.kalshiApiBase.replace(/\/+$/, "")}/`);
  marketsUrl.searchParams.set("limit", String(DEFAULT_LIMIT));
  marketsUrl.searchParams.set("status", "open");

  const nowTs = Math.floor(Date.now() / 1000);
  const bootstrapDaysRaw = Number(process.env.KALSHI_BOOTSTRAP_DAYS ?? DEFAULT_BOOTSTRAP_DAYS);
  const bootstrapDays =
    Number.isFinite(bootstrapDaysRaw) && bootstrapDaysRaw > 0
      ? Math.floor(bootstrapDaysRaw)
      : DEFAULT_BOOTSTRAP_DAYS;
  const maxPagesRaw = Number(process.env.KALSHI_TRADE_MAX_PAGES ?? DEFAULT_MAX_TRADE_PAGES);
  const maxPages =
    Number.isFinite(maxPagesRaw) && maxPagesRaw > 0
      ? Math.floor(maxPagesRaw)
      : DEFAULT_MAX_TRADE_PAGES;
  const parsedCursor = Number(cursor ?? "0");
  const minTs =
    Number.isFinite(parsedCursor) && parsedCursor > 0
      ? parsedCursor
      : nowTs - bootstrapDays * 24 * 60 * 60;

  const trades: Array<Record<string, unknown>> = [];
  let pageCursor = options.paginationCursor?.trim() || null;
  let reachedPageEnd = false;
  let pageCount = 0;
  for (let i = 0; i < maxPages; i += 1) {
    const tradesUrl = new URL("markets/trades", `${config.kalshiApiBase.replace(/\/+$/, "")}/`);
    tradesUrl.searchParams.set("limit", String(DEFAULT_LIMIT));
    tradesUrl.searchParams.set("min_ts", String(minTs));
    if (pageCursor) {
      tradesUrl.searchParams.set("cursor", pageCursor);
    }

    const page = await fetchJson<PaginatedResponse>(tradesUrl.toString());
    pageCount += 1;
    if (page.trades?.length) {
      trades.push(...page.trades);
    }
    const nextPageCursor = page.cursor?.trim() ?? "";
    if (nextPageCursor === "") {
      pageCursor = null;
      reachedPageEnd = true;
      break;
    }
    if (nextPageCursor === pageCursor) {
      // Defensive break for cursor loops in upstream API.
      pageCursor = null;
      break;
    }
    pageCursor = nextPageCursor;
  }

  const marketsPayload = await fetchJson<PaginatedResponse>(marketsUrl.toString());

  const maxTradeTs = trades.reduce((maxTs, trade) => {
    const rawCreated = trade.created_time;
    if (typeof rawCreated !== "string" || rawCreated.trim() === "") {
      return maxTs;
    }

    const parsedTs = Math.floor(new Date(rawCreated).getTime() / 1000);
    if (!Number.isFinite(parsedTs) || parsedTs <= 0) {
      return maxTs;
    }

    return Math.max(maxTs, parsedTs);
  }, minTs);
  const nextCursorTs = pageCursor === null ? Math.max(minTs + 1, maxTradeTs + 1) : minTs;
  const nextCursor = String(nextCursorTs);

  return {
    source: "kalshi-api" as const,
    nextCursor,
    minTs,
    pages: pageCount,
    windowExhausted: pageCursor === null && reachedPageEnd,
    nextPaginationCursor: pageCursor,
    trades,
    markets: marketsPayload.markets ?? [],
  };
}
