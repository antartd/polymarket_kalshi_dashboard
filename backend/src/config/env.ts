import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl:
    process.env.DATABASE_URL ?? "postgres://dashboard:dashboard@localhost:5432/dashboard",
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  duneApiKey: process.env.DUNE_API_KEY ?? "",
  duneQueryId: process.env.DUNE_QUERY_ID ?? "",
  duneSnapshotFile:
    process.env.DUNE_SNAPSHOT_FILE ??
    fileURLToPath(new URL("../../data/dashboard-cache.json", import.meta.url)),
};
