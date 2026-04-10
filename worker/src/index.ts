import "dotenv/config";
import { getConfig, refreshDashboardCache } from "./refresh-cache.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const config = getConfig();
  const intervalMs = Math.max(1, config.refreshIntervalHours) * 60 * 60 * 1000;

  console.log("[worker] starting dune snapshot refresh loop");
  console.log(`[worker] refresh interval: ${config.refreshIntervalHours}h`);

  while (true) {
    try {
      const result = await refreshDashboardCache(config);
      console.log(
        `[worker] refreshed snapshot generatedAt=${result.generatedAt} nextRefreshAt=${result.nextRefreshAt}`,
      );
    } catch (error) {
      console.error("[worker] refresh failed", error);
    }

    await sleep(intervalMs);
  }
}

void main();
