import { Router } from "express";
import { parseFilters } from "../utils/filters.js";
import {
  getAnomalies,
  getCategoryShare,
  getDelta,
  getExportRows,
  getVolume,
} from "../services/analytics.js";

export const analyticsRouter = Router();

analyticsRouter.get("/analytics/volume", async (req, res, next) => {
  try {
    const filters = parseFilters(req.query);
    const data = await getVolume(filters);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

analyticsRouter.get("/analytics/category-share", async (req, res, next) => {
  try {
    const filters = parseFilters(req.query);
    const data = await getCategoryShare(filters);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

analyticsRouter.get("/analytics/delta", async (req, res, next) => {
  try {
    const filters = parseFilters(req.query);
    const data = await getDelta(filters);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

analyticsRouter.get("/analytics/anomalies", async (req, res, next) => {
  try {
    const filters = parseFilters(req.query);
    const data = await getAnomalies(filters);
    res.json(data);
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
