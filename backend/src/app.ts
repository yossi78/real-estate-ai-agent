import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { docsStatic } from "./middleware/docsStatic";
import { errorHandler, notFoundHandler } from "./middleware/httpErrors";
import { createRateLimiter } from "./middleware/rateLimiter";
import { cacheRouter } from "./routes/cache.routes";
import { dealsRouter } from "./routes/deals.routes";
import { healthRouter } from "./routes/health.routes";
import { insightsRouter } from "./routes/insights.routes";
import { metricsRouter } from "./routes/metrics.routes";

export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors());
  app.use("/docs", ...docsStatic());
  app.use(express.json({ limit: "1mb" }));
  app.use(createRateLimiter());
  app.use(healthRouter);
  app.use("/api/deals", dealsRouter);
  app.use("/api/metrics", metricsRouter);
  app.use("/api/insights", insightsRouter);
  app.use("/api/cache", cacheRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
