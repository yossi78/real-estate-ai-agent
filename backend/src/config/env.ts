import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: (process.env.NODE_ENV ?? "development") === "production",
  port: num("PORT", 3001),
  host: process.env.HOST ?? "0.0.0.0",
  redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  cacheTtlSeconds: num("CACHE_TTL_SECONDS", 86_400),
  ollamaBaseUrl: (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, ""),
  ollamaModel: process.env.OLLAMA_MODEL ?? "llama3:8b",
  ollamaTimeoutMs: num("OLLAMA_TIMEOUT_MS", 120000),
  ollamaTemperature: num("OLLAMA_TEMPERATURE", 0.1),
  ollamaMaxConcurrency: num("OLLAMA_MAX_CONCURRENCY", 2),
  rateLimitWindowMs: num("RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
  rateLimitMax: num("RATE_LIMIT_MAX", 300),
  clusterEnabled: bool("CLUSTER_ENABLED", true),
  clusterWorkers: num("CLUSTER_WORKERS", 0),
};

export type Env = typeof env;
