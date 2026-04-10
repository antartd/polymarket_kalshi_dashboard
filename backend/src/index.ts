import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { analyticsRouter } from "./routes/analytics.js";
import { healthRouter } from "./routes/health.js";
import { HttpError } from "./utils/errors.js";

const app = express();

function validateCorsOrigins(origins: string[]) {
  const risky: string[] = [];
  for (const origin of origins) {
    if (origin === "*" || origin.includes("*")) {
      risky.push(origin);
      continue;
    }
    if (!origin.startsWith("http://") && !origin.startsWith("https://")) {
      risky.push(origin);
      continue;
    }
    const isLocal =
      origin.startsWith("http://localhost") ||
      origin.startsWith("http://127.0.0.1") ||
      origin.startsWith("https://localhost") ||
      origin.startsWith("https://127.0.0.1");
    if (!isLocal && origin.startsWith("http://")) {
      risky.push(origin);
    }
  }
  if (risky.length > 0) {
    console.warn(`[startup] risky CORS origins detected: ${risky.join(", ")}`);
  }
}

validateCorsOrigins(env.corsOrigins);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked origin: ${origin}`));
    },
  }),
);
app.use(express.json());

app.use("/api", healthRouter);
app.use("/api", analyticsRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      error: {
        message: error.message,
        details: error.details ?? null,
      },
    });
    return;
  }

  console.error("Unhandled API error", error);
  res.status(500).json({
    error: {
      message: "Internal server error",
    },
  });
});

app.listen(env.port, () => {
  console.log(`Backend API running on http://localhost:${env.port}`);
});
