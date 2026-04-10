import { runMarketSyncJob } from "./jobs/sync-markets.js";
import { runTradeSyncJob } from "./jobs/sync-trades.js";
import { runRefreshAggregatesJob } from "./jobs/refresh-aggregates.js";

const cycles = Number(process.env.BACKFILL_CYCLES ?? 20);
const sleepMs = Number(process.env.BACKFILL_SLEEP_MS ?? 800);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`[backfill] starting cycles=${cycles} sleep_ms=${sleepMs}`);

  for (let i = 1; i <= cycles; i += 1) {
    if (i === 1 || i % 5 === 0) {
      await runMarketSyncJob();
    }

    await runTradeSyncJob();
    await runRefreshAggregatesJob();

    console.log(`[backfill] cycle ${i}/${cycles} completed`);
    if (i < cycles) {
      await sleep(sleepMs);
    }
  }

  console.log("[backfill] completed");
}

main().catch((error) => {
  console.error("[backfill] failed", error);
  process.exit(1);
});

