import { Router, type Request, type Response } from "express";
import { parseFilters, type ParsedFilters } from "../utils/filters.js";
import {
  getAnomalies,
  getCategoryShare,
  getDelta,
  getExportRows,
  getLastUpdated,
  getVolume,
} from "../services/analytics.js";
import { buildCacheKey, getCached, setCached } from "../utils/response-cache.js";

export const analyticsRouter = Router();
const CACHE_TTL_MS = 10_000;
const LIVE_WARM_TTL_MS = 15_000;

async function respondWithCachedJson<T>(
  req: Request,
  res: Response,
  fetcher: () => Promise<T>,
) {
  const key = buildCacheKey(req.path, req.query as Record<string, unknown>);
  const cached = getCached<T>(key);
  if (cached !== null) {
    res.json(cached);
    return;
  }

  const payload = await fetcher();
  setCached(key, payload, CACHE_TTL_MS);
  res.json(payload);
}

function warmLiveCache<T>(
  path: string,
  filters: ParsedFilters,
  fetcher: (filters: ParsedFilters) => Promise<T>,
) {
  if (filters.source !== "dune") {
    return;
  }

  const liveFilters: ParsedFilters = { ...filters, source: "live" };
  const liveQuery = {
    range: liveFilters.range,
    source: liveFilters.source,
    categories: liveFilters.categories.join(","),
    platforms: liveFilters.platforms.join(","),
  };
  const key = buildCacheKey(path, liveQuery);

  void fetcher(liveFilters)
    .then((payload) => {
      setCached(key, payload, LIVE_WARM_TTL_MS);
    })
    .catch((error) => {
      console.error("Failed to warm live cache", error);
    });
}

analyticsRouter.get("/analytics/volume", async (req, res, next) => {
  try {
    const filters = parseFilters(req.query);
    warmLiveCache(req.path, filters, getVolume);
    await respondWithCachedJson(req, res, () => getVolume(filters));
  } catch (error) {
    next(error);
  }
});

analyticsRouter.get("/analytics/category-share", async (req, res, next) => {
  try {
    const filters = parseFilters(req.query);
    warmLiveCache(req.path, filters, getCategoryShare);
    await respondWithCachedJson(req, res, () => getCategoryShare(filters));
  } catch (error) {
    next(error);
  }
});

analyticsRouter.get("/analytics/delta", async (req, res, next) => {
  try {
    const filters = parseFilters(req.query);
    warmLiveCache(req.path, filters, getDelta);
    await respondWithCachedJson(req, res, () => getDelta(filters));
  } catch (error) {
    next(error);
  }
});

analyticsRouter.get("/analytics/anomalies", async (req, res, next) => {
  try {
    const filters = parseFilters(req.query);
    warmLiveCache(req.path, filters, getAnomalies);
    await respondWithCachedJson(req, res, () => getAnomalies(filters));
  } catch (error) {
    next(error);
  }
});

analyticsRouter.get("/analytics/last-updated", async (req, res, next) => {
  try {
    await respondWithCachedJson(req, res, () => getLastUpdated());
  } catch (error) {
    next(error);
  }
});

analyticsRouter.get("/analytics/stream", async (req, res, next) => {
  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const emit = async () => {
      const payload = await getLastUpdated();
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    await emit();
    const interval = setInterval(() => {
      void emit();
    }, 15_000);

    req.on("close", () => {
      clearInterval(interval);
      res.end();
    });
  } catch (error) {
    next(error);
  }
});

analyticsRouter.get("/analytics/export.csv", async (req, res, next) => {
  try {
    const filters = parseFilters(req.query);
    const rows = await getExportRows(filters);

    const header = "date,platform,category,volume_usd";
    const lines = rows.map((row) => `${row.date},${row.platform},${row.category},${row.volume_usd}`);
    const csv = [header, ...lines].join("\n");

    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `volume_export_${filters.range}_${dateStamp}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
});
