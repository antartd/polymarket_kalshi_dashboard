import dotenv from "dotenv";

dotenv.config();

const defaultGraphUrl = "https://api.thegraph.com/subgraphs/name/polymarket/matic-markets";
const rawGraphUrl = process.env.POLYMARKET_GRAPH_URL ?? defaultGraphUrl;
const sanitizedGraphUrl = rawGraphUrl.includes("error.thegraph.com") ? defaultGraphUrl : rawGraphUrl;

export const config = {
  databaseUrl:
    process.env.DATABASE_URL ?? "postgres://dashboard:dashboard@localhost:5432/dashboard",
  pollSeconds: Number(process.env.POLL_SECONDS ?? 60),
  polymarketGammaBase:
    process.env.POLYMARKET_GAMMA_BASE ?? "https://gamma-api.polymarket.com",
  polymarketDataBase:
    process.env.POLYMARKET_DATA_BASE ?? "https://data-api.polymarket.com",
  polymarketGraphUrl: sanitizedGraphUrl,
  kalshiApiBase:
    process.env.KALSHI_API_BASE ?? "https://api.elections.kalshi.com/trade-api/v2",
};
