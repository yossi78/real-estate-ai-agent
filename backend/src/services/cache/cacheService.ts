import { env } from "../../config/env";
import { AppError } from "../../middleware/errorHandler";
import type { InsightEvaluation } from "../../types/domain";
import { cacheKey, flushRedis, redisDelPattern, redisGet, redisSet } from "./redisClient";

export async function getJson<T>(key: string): Promise<T | null> {
  const raw = await redisGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setJson(key: string, value: unknown, ttlSeconds = env.cacheTtlSeconds): Promise<void> {
  await redisSet(key, JSON.stringify(value), ttlSeconds);
}

export function neighborhoodStatsKey(city: string, neighborhood: string): string {
  return cacheKey(["stats", "neighborhood", city, neighborhood]);
}

export function globalStatsKey(): string {
  return cacheKey(["stats", "global"]);
}

export function insightKey(kind: "deal" | "neighborhood", subject: InsightEvaluation["subject"]): string {
  if (kind === "deal" && subject.dealId) {
    return cacheKey(["insight", "deal", subject.dealId]);
  }
  return cacheKey(["insight", "neighborhood", subject.city ?? "_", subject.neighborhood ?? "_"]);
}

export function corpusKey(): string {
  return cacheKey(["corpus", "deals"]);
}

export async function bustStatsCache(): Promise<void> {
  await redisDelPattern("stats:*");
  await redisDelPattern("insight:*");
}

export async function flushAllCache(): Promise<{ ok: true; message: string }> {
  const flushed = await flushRedis();
  if (!flushed) {
    throw new AppError(503, "Redis לא זמין — לא ניתן לנקות את המטמון", "REDIS_UNAVAILABLE");
  }
  return { ok: true, message: "המטמון נוקה" };
}
