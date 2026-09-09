import { bustStatsCache, corpusKey, flushAllCache, getJson, globalStatsKey, insightKey, neighborhoodStatsKey, setJson } from "../../src/services/cache/cacheService";
import { AppError } from "../../src/middleware/errorHandler";

jest.mock("../../src/services/cache/redisClient", () => ({
  redisGet: jest.fn(),
  redisSet: jest.fn(),
  redisDelPattern: jest.fn(),
  flushRedis: jest.fn(),
  cacheKey: (parts: string[]) => parts.join(":"),
}));

jest.mock("../../src/config/env", () => ({
  env: { cacheTtlSeconds: 86400 },
}));

import { flushRedis, redisDelPattern, redisGet, redisSet } from "../../src/services/cache/redisClient";

const mockedGet = redisGet as jest.MockedFunction<typeof redisGet>;
const mockedSet = redisSet as jest.MockedFunction<typeof redisSet>;
const mockedDel = redisDelPattern as jest.MockedFunction<typeof redisDelPattern>;
const mockedFlush = flushRedis as jest.MockedFunction<typeof flushRedis>;

describe("cacheService", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedSet.mockReset();
    mockedDel.mockReset();
    mockedFlush.mockReset();
  });

  it("parses JSON values and returns null on miss or invalid JSON", async () => {
    mockedGet.mockResolvedValueOnce(JSON.stringify({ a: 1 }));
    await expect(getJson<{ a: number }>("k")).resolves.toEqual({ a: 1 });

    mockedGet.mockResolvedValueOnce(null);
    await expect(getJson("k")).resolves.toBeNull();

    mockedGet.mockResolvedValueOnce("{not-json");
    await expect(getJson("k")).resolves.toBeNull();
  });

  it("serializes values and forwards the default TTL", async () => {
    mockedSet.mockResolvedValue(undefined);
    await setJson("k", { hello: "world" });
    expect(mockedSet).toHaveBeenCalledWith("k", JSON.stringify({ hello: "world" }), 86400);
  });

  it("forwards a custom TTL", async () => {
    mockedSet.mockResolvedValue(undefined);
    await setJson("k", 1, 10);
    expect(mockedSet).toHaveBeenCalledWith("k", "1", 10);
  });

  it("builds cache keys", () => {
    expect(neighborhoodStatsKey("תל אביב", "פלורנטין")).toBe("stats:neighborhood:תל אביב:פלורנטין");
    expect(globalStatsKey()).toBe("stats:global");
    expect(insightKey("deal", { dealId: "TLV-029", neighborhood: "פלורנטין" })).toBe("insight:deal:TLV-029");
    expect(insightKey("neighborhood", { city: "תל אביב", neighborhood: "פלורנטין" })).toBe(
      "insight:neighborhood:תל אביב:פלורנטין",
    );
    expect(corpusKey()).toBe("corpus:deals");
  });

  it("busts stats and insight keys", async () => {
    mockedDel.mockResolvedValue(undefined);
    await bustStatsCache();
    expect(mockedDel).toHaveBeenCalledWith("stats:*");
    expect(mockedDel).toHaveBeenCalledWith("insight:*");
  });

  it("flushes Redis and returns a Hebrew confirmation", async () => {
    mockedFlush.mockResolvedValue(true);
    await expect(flushAllCache()).resolves.toEqual({ ok: true, message: "המטמון נוקה" });
  });

  it("throws when Redis is unavailable", async () => {
    mockedFlush.mockResolvedValue(false);
    await expect(flushAllCache()).rejects.toMatchObject({
      statusCode: 503,
      code: "REDIS_UNAVAILABLE",
    });
    await expect(flushAllCache()).rejects.toBeInstanceOf(AppError);
  });
});
