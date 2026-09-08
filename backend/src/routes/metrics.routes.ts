import { Router } from "express";
import { getCachedGlobalMetrics, getCachedNeighborhood } from "../services/valuation/valuationService";

export const metricsRouter = Router();

metricsRouter.get("/", async (_req, res, next) => {
  try {
    const metrics = await getCachedGlobalMetrics();
    res.json({ metricsSource: "calculated", metrics });
  } catch (error) {
    next(error);
  }
});

metricsRouter.get("/neighborhoods/:name", async (req, res, next) => {
  try {
    const stats = await getCachedNeighborhood(req.params.name);
    res.json({ metricsSource: "calculated", stats });
  } catch (error) {
    next(error);
  }
});
