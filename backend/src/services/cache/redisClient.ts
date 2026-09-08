import { createHash } from "crypto";
import Redis from "ioredis";
import { env } from "../../config/env";
import { logger } from "../../config/logger";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(env.redisUrl, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    client.on("error", (error) => {
      logger.warn("redis_error", { message: error.message });
    });
  }
  return client;
}

export async function connectRedis(): Promise<void> {
  const redis = getRedis();
  if (["connect", "ready"].includes(redis.status)) return;
  try {
    await redis.connect();
  } catch (error) {
    logger.warn("redis_connect_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function pingRedis(): Promise<boolean> {
  try {
    const redis = getRedis();
    if (redis.status !== "ready") await connectRedis();
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}

export async function redisGet(key: string): Promise<string | null> {
  try {
    return await getRedis().get(key);
  } catch {
    return null;
  }
}

export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  try {
    if (ttlSeconds && ttlSeconds > 0) {
      await getRedis().set(key, value, "EX", ttlSeconds);
      return;
    }
    await getRedis().set(key, value);
  } catch (error) {
    logger.warn("redis_set_failed", {
      key,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function redisDelPattern(pattern: string): Promise<void> {
  try {
    const redis = getRedis();
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = next;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== "0");
  } catch (error) {
    logger.warn("redis_del_failed", {
      pattern,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export function cacheKey(parts: string[]): string {
  return parts.map((p) => p.replace(/:/g, "_")).join(":");
}

export function hashPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24);
}
