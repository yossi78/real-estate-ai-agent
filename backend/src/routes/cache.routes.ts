import { Router } from "express";
import { flushAllCache } from "../services/cache/cacheService";
import { persistCorpus } from "../store/dealStore";

export const cacheRouter = Router();

cacheRouter.post("/flush", async (_req, res, next) => {
  try {
    const result = await flushAllCache();
    await persistCorpus();
    res.json(result);
  } catch (error) {
    next(error);
  }
});
