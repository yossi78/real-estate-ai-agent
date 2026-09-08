import cluster from "cluster";
import os from "os";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { createApp } from "./app";
import { connectRedis } from "./services/cache/redisClient";
import { loadSampleDeals } from "./store/dealStore";

function workerCount(): number {
  if (env.clusterWorkers > 0) return env.clusterWorkers;
  return Math.max(1, os.cpus().length);
}

async function startWorker(): Promise<void> {
  await connectRedis();
  await loadSampleDeals();
  const app = createApp();
  app.listen(env.port, env.host, () => {
    logger.info("worker_listening", {
      pid: process.pid,
      host: env.host,
      port: env.port,
    });
  });
}

async function start(): Promise<void> {
  const shouldCluster = env.clusterEnabled && env.isProduction && cluster.isPrimary;
  if (shouldCluster) {
    const n = workerCount();
    logger.info("cluster_primary", { workers: n, pid: process.pid });
    for (let i = 0; i < n; i += 1) {
      cluster.fork();
    }
    cluster.on("exit", (worker, code, signal) => {
      logger.warn("worker_exit", { pid: worker.process.pid, code, signal });
      cluster.fork();
    });
    return;
  }
  await startWorker();
}

start().catch((error) => {
  logger.error("fatal_start", { message: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
