import { Router } from "express";
import { env } from "../config/env";
import { pingRedis } from "../services/cache/redisClient";
import { pingOllama } from "../services/llm/ollamaClient";
import { getDeals } from "../store/dealStore";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  const [redis, ollama] = await Promise.all([pingRedis(), pingOllama()]);
  res.json({
    status: redis ? "ok" : "degraded",
    service: "real-estate-ai-agent",
    dealsLoaded: getDeals().length,
    redis,
    ollama,
    model: env.ollamaModel,
    llmTimeoutMs: env.ollamaTimeoutMs,
    uptimeSec: Math.round(process.uptime()),
  });
});
