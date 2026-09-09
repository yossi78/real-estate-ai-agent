import type { RequestHandler } from "express";
import rateLimit, { type Store } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { getRedis } from "../services/cache/redisClient";

export function createRateLimiter(): RequestHandler {
  let store: Store | undefined;

  try {
    const redis = getRedis();
    store = new RedisStore({
      sendCommand: ((...args: string[]) => redis.call(args[0], ...args.slice(1))) as (
        ...args: string[]
      ) => Promise<string>,
      prefix: "rl:",
    });
  } catch (error) {
    logger.warn("rate_limit_memory_fallback", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  return rateLimit({
    windowMs: env.rateLimitWindowMs,
    max: env.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    store,
    validate: { xForwardedForHeader: false },
    message: {
      error: "RATE_LIMITED",
      message: "חריגה ממגבלת הבקשות. נסו שוב בעוד כמה דקות.",
    },
  });
}
