import { pool } from "./db.js";
import { runCleanupJob } from "./jobs/cleanup.js";
import { runMarketSyncJob } from "./jobs/sync-markets.js";
import { runTradeSyncJob } from "./jobs/sync-trades.js";
import { runRefreshAggregatesJob } from "./jobs/refresh-aggregates.js";

const pollSeconds = Number(process.env.POLL_SECONDS ?? 60);

async function safeRun(name: string, fn: () => Promise<void>) {
  try {
    const started = Date.now();
    await fn();
    const durationMs = Date.now() - started;
    console.log(`[ingestion] ${name} finished in ${durationMs}ms`);
  } catch (error) {
    console.error(`[ingestion] ${name} failed`, error);
  }
}

async function tick() {
  await safeRun("trade-sync", runTradeSyncJob);
  await safeRun("refresh-aggregates", runRefreshAggregatesJob);
}

async function boot() {
  await safeRun("market-sync", runMarketSyncJob);
  await tick();

  setInterval(() => {
    void tick();
  }, pollSeconds * 1000);

  setInterval(() => {
    void safeRun("market-sync", runMarketSyncJob);
  }, 10 * 60 * 1000);

  setInterval(() => {
    void safeRun("cleanup", runCleanupJob);
  }, 24 * 60 * 60 * 1000);

  console.log(`[ingestion] started with poll interval ${pollSeconds}s`);
}

boot().catch((error) => {
  console.error("Failed to boot ingestion", error);
  void pool.end();
  process.exit(1);
});
