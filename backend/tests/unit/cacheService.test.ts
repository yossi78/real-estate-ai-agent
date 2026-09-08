import { bustStatsCache, corpusKey, getJson, globalStatsKey, insightKey, neighborhoodStatsKey, setJson } from "../../src/services/cache/cacheService";

jest.mock("../../src/services/cache/redisClient", () => ({
  redisGet: jest.fn(),
  redisSet: jest.fn(),
  redisDelPattern: jest.fn(),
  cacheKey: (parts: string[]) => parts.join(":"),
}));

jest.mock("../../src/config/env", () => ({
  env: { cacheTtlSeconds: 86400 },
}));

import { redisDelPattern, redisGet, redisSet } from "../../src/services/cache/redisClient";

const mockedGet = redisGet as jest.MockedFunction<typeof redisGet>;
const mockedSet = redisSet as jest.MockedFunction<typeof redisSet>;
const mockedDel = redisDelPattern as jest.MockedFunction<typeof redisDelPattern>;

describe("cacheService", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedSet.mockReset();
    mockedDel.mockReset();
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
});
