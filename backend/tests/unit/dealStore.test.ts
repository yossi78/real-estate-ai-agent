import fs from "fs";
import { findDealById, getDeals, hydrateCorpusFromRedis, loadDealsFromCsv, loadSampleDeals, persistCorpus, setDeals } from "../../src/store/dealStore";
import type { Deal } from "../../src/types/domain";

jest.mock("../../src/services/cache/cacheService", () => ({
  corpusKey: () => "corpus:deals",
  getJson: jest.fn(),
  setJson: jest.fn(),
}));

jest.mock("../../src/config/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { getJson, setJson } from "../../src/services/cache/cacheService";
import { logger } from "../../src/config/logger";

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

const mockedGet = getJson as jest.MockedFunction<typeof getJson>;
const mockedSet = setJson as jest.MockedFunction<typeof setJson>;

const sampleCsv = [
  "dealId,date,city,neighborhood,street,rooms,floor,sqm,priceNis,propertyType,yearBuilt",
  "A-1,2024-01-02,תל אביב,פלורנטין,הרצל,3,2,70,2100000,דירה,1960",
  "A-2,2024-01-03,תל אביב,פלורנטין,הרצל,0,2,70,2100000,דירה,1960",
].join("\n");

describe("dealStore", () => {
  beforeEach(() => {
    setDeals([]);
    mockedGet.mockReset();
    mockedSet.mockReset();
    (fs.existsSync as jest.Mock).mockReset();
    (fs.readFileSync as jest.Mock).mockReset();
    (logger.info as jest.Mock).mockReset();
    (logger.warn as jest.Mock).mockReset();
  });

  it("sets, lists, and finds deals by id", () => {
    const deal = {
      dealId: "X",
      date: "2024-01-01",
      year: 2024,
      city: "תל אביב",
      neighborhood: "פלורנטין",
      street: "הרצל",
      rooms: 3,
      floor: 1,
      sqm: 70,
      priceNis: 2_100_000,
      pricePerSqm: 30000,
      propertyType: "דירה",
      yearBuilt: 1960,
    } satisfies Deal;
    setDeals([deal]);
    expect(getDeals()).toEqual([deal]);
    expect(findDealById("X")).toEqual(deal);
    expect(findDealById("missing")).toBeUndefined();
  });

  it("loads a CSV into the in-memory corpus and reports dropped rows", () => {
    const result = loadDealsFromCsv(sampleCsv);
    expect(result.deals).toHaveLength(1);
    expect(result.deals[0].dealId).toBe("A-1");
    expect(result.dropped).toBe(1);
    expect(getDeals()).toHaveLength(1);
  });

  it("persists the current corpus with no TTL", async () => {
    setDeals([{ dealId: "X" } as Deal]);
    mockedSet.mockResolvedValue(undefined);
    await persistCorpus();
    expect(mockedSet).toHaveBeenCalledWith("corpus:deals", expect.any(Array), 0);
  });

  it("hydrates from Redis when a non-empty corpus is stored", async () => {
    const stored = [{ dealId: "R-1" }] as Deal[];
    mockedGet.mockResolvedValue(stored);
    await expect(hydrateCorpusFromRedis()).resolves.toBe(true);
    expect(getDeals()).toEqual(stored);
  });

  it("does not overwrite local deals when Redis is empty", async () => {
    setDeals([{ dealId: "LOCAL" } as Deal]);
    mockedGet.mockResolvedValue([]);
    await expect(hydrateCorpusFromRedis()).resolves.toBe(false);
    expect(getDeals()[0].dealId).toBe("LOCAL");

    mockedGet.mockResolvedValue(null);
    await expect(hydrateCorpusFromRedis()).resolves.toBe(false);
  });

  it("skips the sample CSV when Redis already has a corpus", async () => {
    mockedGet.mockResolvedValue([{ dealId: "R-1" }] as Deal[]);
    await loadSampleDeals();
    expect(fs.existsSync).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith("corpus_hydrated_from_redis", { count: 1 });
  });

  it("warns when the sample CSV is missing", async () => {
    mockedGet.mockResolvedValue(null);
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    await loadSampleDeals();
    expect(logger.warn).toHaveBeenCalledWith("sample_csv_missing");
  });

  it("loads and persists the sample CSV when Redis is empty", async () => {
    mockedGet.mockResolvedValue(null);
    mockedSet.mockResolvedValue(undefined);
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from(sampleCsv));
    await loadSampleDeals();
    expect(getDeals()[0].dealId).toBe("A-1");
    expect(mockedSet).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      "sample_deals_loaded",
      expect.objectContaining({ count: 1, dropped: 1 }),
    );
  });
});
