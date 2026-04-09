import { Router } from "express";
import { pool } from "../db/pool.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      ok: true,
      services: {
        db: "up",
      },
    });
  } catch (error) {
    next(error);
  }
});
