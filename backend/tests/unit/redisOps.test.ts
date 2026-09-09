const mockRedis = {
  status: "wait",
  on: jest.fn(),
  connect: jest.fn(),
  ping: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  scan: jest.fn(),
  del: jest.fn(),
  flushdb: jest.fn(),
};

jest.mock("ioredis", () => jest.fn().mockImplementation(() => mockRedis));

jest.mock("../../src/config/logger", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import {
  connectRedis,
  flushRedis,
  getRedis,
  pingRedis,
  redisDelPattern,
  redisGet,
  redisSet,
} from "../../src/services/cache/redisClient";
import { logger } from "../../src/config/logger";

describe("redisClient operations", () => {
  beforeEach(() => {
    mockRedis.status = "wait";
    mockRedis.connect.mockReset().mockResolvedValue(undefined);
    mockRedis.ping.mockReset().mockResolvedValue("PONG");
    mockRedis.get.mockReset();
    mockRedis.set.mockReset();
    mockRedis.scan.mockReset();
    mockRedis.del.mockReset();
    mockRedis.flushdb.mockReset().mockResolvedValue("OK");
    (logger.warn as jest.Mock).mockReset();
    (logger.info as jest.Mock).mockReset();
    getRedis();
  });

  it("logs client error events", () => {
    const handler = mockRedis.on.mock.calls.find((call) => call[0] === "error")?.[1] as (err: Error) => void;
    handler(new Error("lost"));
    expect(logger.warn).toHaveBeenCalledWith("redis_error", { message: "lost" });
  });

  it("connects when the client is idle and no-ops when already ready", async () => {
    mockRedis.status = "wait";
    await connectRedis();
    expect(mockRedis.connect).toHaveBeenCalled();

    mockRedis.connect.mockClear();
    mockRedis.status = "ready";
    await connectRedis();
    expect(mockRedis.connect).not.toHaveBeenCalled();

    mockRedis.status = "connect";
    await connectRedis();
    expect(mockRedis.connect).not.toHaveBeenCalled();
  });

  it("swallows connection failures", async () => {
    mockRedis.status = "wait";
    mockRedis.connect.mockRejectedValue(new Error("ECONNREFUSED"));
    await connectRedis();
    expect(logger.warn).toHaveBeenCalledWith("redis_connect_failed", { message: "ECONNREFUSED" });

    mockRedis.connect.mockRejectedValue("offline");
    await connectRedis();
    expect(logger.warn).toHaveBeenCalledWith("redis_connect_failed", { message: "offline" });
  });

  it("pings successfully, connects if needed, and returns false on errors", async () => {
    mockRedis.status = "wait";
    mockRedis.connect.mockImplementation(async () => {
      mockRedis.status = "ready";
    });
    await expect(pingRedis()).resolves.toBe(true);
    expect(mockRedis.connect).toHaveBeenCalled();

    mockRedis.ping.mockResolvedValue("NOPE");
    await expect(pingRedis()).resolves.toBe(false);

    mockRedis.ping.mockRejectedValue(new Error("down"));
    await expect(pingRedis()).resolves.toBe(false);
  });

  it("gets values and returns null on failure", async () => {
    mockRedis.get.mockResolvedValue("v");
    await expect(redisGet("k")).resolves.toBe("v");
    mockRedis.get.mockRejectedValue(new Error("x"));
    await expect(redisGet("k")).resolves.toBeNull();
  });

  it("sets with and without TTL and logs set failures", async () => {
    mockRedis.set.mockResolvedValue("OK");
    await redisSet("k", "v", 30);
    expect(mockRedis.set).toHaveBeenCalledWith("k", "v", "EX", 30);

    await redisSet("k", "v", 0);
    expect(mockRedis.set).toHaveBeenCalledWith("k", "v");

    mockRedis.set.mockRejectedValue(new Error("write"));
    await redisSet("k", "v");
    expect(logger.warn).toHaveBeenCalledWith("redis_set_failed", { key: "k", message: "write" });

    mockRedis.set.mockRejectedValue("write-fail");
    await redisSet("k", "v");
    expect(logger.warn).toHaveBeenCalledWith("redis_set_failed", { key: "k", message: "write-fail" });
  });

  it("scans and deletes matching keys across cursors", async () => {
    mockRedis.scan
      .mockResolvedValueOnce(["1", ["a"]])
      .mockResolvedValueOnce(["0", ["b", "c"]]);
    mockRedis.del.mockResolvedValue(1);
    await redisDelPattern("stats:*");
    expect(mockRedis.del).toHaveBeenCalledWith("a");
    expect(mockRedis.del).toHaveBeenCalledWith("b", "c");
  });

  it("does not call del when a scan page is empty and logs delete failures", async () => {
    mockRedis.scan.mockResolvedValueOnce(["0", []]);
    await redisDelPattern("insight:*");
    expect(mockRedis.del).not.toHaveBeenCalled();

    mockRedis.scan.mockRejectedValue(new Error("scan"));
    await redisDelPattern("x");
    expect(logger.warn).toHaveBeenCalledWith("redis_del_failed", { pattern: "x", message: "scan" });

    mockRedis.scan.mockRejectedValue("scan-fail");
    await redisDelPattern("x");
    expect(logger.warn).toHaveBeenCalledWith("redis_del_failed", { pattern: "x", message: "scan-fail" });
  });

  it("flushes the current database on boot when Redis is ready", async () => {
    mockRedis.status = "ready";
    await expect(flushRedis()).resolves.toBe(true);
    expect(mockRedis.flushdb).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith("redis_flushed");
  });

  it("connects before flushing when the client is idle", async () => {
    mockRedis.status = "wait";
    mockRedis.connect.mockImplementation(async () => {
      mockRedis.status = "ready";
    });
    await expect(flushRedis()).resolves.toBe(true);
    expect(mockRedis.connect).toHaveBeenCalled();
    expect(mockRedis.flushdb).toHaveBeenCalled();
  });

  it("skips flush when Redis never becomes ready", async () => {
    mockRedis.status = "wait";
    mockRedis.connect.mockResolvedValue(undefined);
    await expect(flushRedis()).resolves.toBe(false);
    expect(mockRedis.flushdb).not.toHaveBeenCalled();
  });

  it("logs flush failures without throwing", async () => {
    mockRedis.status = "ready";
    mockRedis.flushdb.mockRejectedValue(new Error("denied"));
    await expect(flushRedis()).resolves.toBe(false);
    expect(logger.warn).toHaveBeenCalledWith("redis_flush_failed", { message: "denied" });

    mockRedis.flushdb.mockRejectedValue("flush-fail");
    await expect(flushRedis()).resolves.toBe(false);
    expect(logger.warn).toHaveBeenCalledWith("redis_flush_failed", { message: "flush-fail" });
  });
});
