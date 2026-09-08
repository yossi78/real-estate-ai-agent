import { env } from "../../config/env";
import type { InsightEvaluation } from "../../types/domain";
import { cacheKey, redisDelPattern, redisGet, redisSet } from "./redisClient";

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
