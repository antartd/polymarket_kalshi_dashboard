import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { analyticsRouter } from "./routes/analytics.js";
import { healthRouter } from "./routes/health.js";
import { HttpError } from "./utils/errors.js";

const app = express();

app.use(cors({ origin: env.corsOrigin }));
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
