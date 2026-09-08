import { NotFoundError, ValidationError } from "../../src/middleware/errorHandler";
import type { Deal, InsightEvaluation, NeighborhoodStats } from "../../src/types/domain";

jest.mock("../../src/store/dealStore", () => ({
  hydrateCorpusFromRedis: jest.fn().mockResolvedValue(false),
  getDeals: jest.fn().mockReturnValue([]),
  findDealById: jest.fn(),
  loadDealsFromCsv: jest.fn(),
  persistCorpus: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../src/services/cache/cacheService", () => ({
  bustStatsCache: jest.fn().mockResolvedValue(undefined),
  getJson: jest.fn().mockResolvedValue(null),
  setJson: jest.fn().mockResolvedValue(undefined),
  globalStatsKey: () => "stats:global",
  neighborhoodStatsKey: (city: string, neighborhood: string) => `stats:neighborhood:${city}:${neighborhood}`,
}));

jest.mock("../../src/services/llm/insightService", () => ({
  insightFromDealMetrics: jest.fn(),
  insightFromNeighborhood: jest.fn(),
}));

import { getDeals, findDealById, hydrateCorpusFromRedis, loadDealsFromCsv, persistCorpus } from "../../src/store/dealStore";
import { bustStatsCache, getJson, setJson } from "../../src/services/cache/cacheService";
import { insightFromDealMetrics, insightFromNeighborhood } from "../../src/services/llm/insightService";
import {
  evaluateSubject,
  getCachedGlobalMetrics,
  getCachedNeighborhood,
  ingestCsv,
  listDeals,
} from "../../src/services/valuation/valuationService";

function deal(overrides: Partial<Deal> = {}): Deal {
  return {
    dealId: "A-1",
    date: "2024-01-01",
    year: 2024,
    city: "תל אביב",
    neighborhood: "פלורנטין",
    street: "הרצל",
    rooms: 3,
    floor: 2,
    sqm: 70,
    priceNis: 2_100_000,
    pricePerSqm: 30000,
    propertyType: "דירה",
    yearBuilt: 1960,
    ...overrides,
  };
}

const evaluation: InsightEvaluation = {
  metricsSource: "calculated",
  insightSource: "fallback",
  fallbackUsed: true,
  cached: false,
  generatedAt: "2026-01-01T00:00:00.000Z",
  subject: { dealId: "A-1" },
  stats: {},
  insight: {
    summary: "סיכום ארוך מספיק",
    opportunityScore: 50,
    verdict: "hold",
    pros: ["יתרון אחד ארוך", "יתרון שני ארוך"],
    cons: ["חיסרון אחד ארוך", "חיסרון שני ארוך"],
    risks: ["סיכון ארוך"],
    buyerTips: ["טיפ אחד ארוך", "טיפ שני ארוך"],
    marketNarrative: "נרטיב ארוך מספיק",
  },
};

describe("valuationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (hydrateCorpusFromRedis as jest.Mock).mockResolvedValue(false);
    (persistCorpus as jest.Mock).mockResolvedValue(undefined);
    (bustStatsCache as jest.Mock).mockResolvedValue(undefined);
    (getJson as jest.Mock).mockResolvedValue(null);
    (setJson as jest.Mock).mockResolvedValue(undefined);
    (getDeals as jest.Mock).mockReturnValue([]);
    (findDealById as jest.Mock).mockReturnValue(undefined);
  });

  describe("listDeals", () => {
    const deals = [
      deal({ dealId: "1", neighborhood: "פלורנטין", street: "הרצל" }),
      deal({ dealId: "2", neighborhood: "פלורנטין", street: "אלנבי" }),
      deal({ dealId: "3", neighborhood: "רמת אביב", street: "ברודצקי" }),
    ];

    it("paginates and filters by neighborhood and street", async () => {
      (getDeals as jest.Mock).mockReturnValue(deals);
      const page1 = await listDeals({ page: 1, limit: 2 });
      expect(page1.total).toBe(3);
      expect(page1.items).toHaveLength(2);
      expect(page1.page).toBe(1);
      expect(page1.limit).toBe(2);

      const hood = await listDeals({ neighborhood: "  פלורנטין ", page: 1, limit: 25 });
      expect(hood.total).toBe(2);

      const street = await listDeals({ street: "ברודצקי" });
      expect(street.total).toBe(1);
      expect(street.items[0].dealId).toBe("3");
    });

    it("clamps page and limit", async () => {
      (getDeals as jest.Mock).mockReturnValue(Array.from({ length: 3 }, (_, i) => deal({ dealId: String(i) })));
      const result = await listDeals({ page: 0, limit: 500 });
      expect(result.page).toBe(1);
      expect(result.limit).toBe(100);

      const tiny = await listDeals({ limit: 0 });
      expect(tiny.limit).toBe(1);
    });
  });

  describe("ingestCsv", () => {
    it("persists a cleaned corpus and busts caches", async () => {
      (loadDealsFromCsv as jest.Mock).mockReturnValue({ deals: [deal()], dropped: 2 });
      await expect(ingestCsv(Buffer.from("csv"))).resolves.toEqual({ count: 1, dropped: 2 });
      expect(persistCorpus).toHaveBeenCalled();
      expect(bustStatsCache).toHaveBeenCalled();
    });

    it("rejects a CSV that yields no valid deals", async () => {
      (loadDealsFromCsv as jest.Mock).mockReturnValue({ deals: [], dropped: 4 });
      await expect(ingestCsv(Buffer.from("csv"))).rejects.toBeInstanceOf(ValidationError);
      expect(persistCorpus).not.toHaveBeenCalled();
    });
  });

  describe("cached metrics", () => {
    it("returns cached global metrics without recomputing", async () => {
      const cached = { dealCount: 9, cities: [], neighborhoods: [], price: {}, pricePerSqm: {}, historicalCagrPct: null };
      (getJson as jest.Mock).mockResolvedValue(cached);
      await expect(getCachedGlobalMetrics()).resolves.toEqual(cached);
      expect(setJson).not.toHaveBeenCalled();
    });

    it("writes a Redis key per neighborhood when serving global metrics", async () => {
      const cached = {
        dealCount: 2,
        cities: ["תל אביב"],
        neighborhoods: [
          { city: "תל אביב", neighborhood: "רמת אביב" },
          { city: "תל אביב", neighborhood: "פלורנטין" },
        ],
        price: {},
        pricePerSqm: {},
        historicalCagrPct: null,
      };
      (getJson as jest.Mock).mockResolvedValue(cached);
      await getCachedGlobalMetrics();
      expect(setJson).toHaveBeenCalledWith("stats:neighborhood:תל אביב:רמת אביב", cached.neighborhoods[0]);
      expect(setJson).toHaveBeenCalledWith("stats:neighborhood:תל אביב:פלורנטין", cached.neighborhoods[1]);
      expect(setJson).not.toHaveBeenCalledWith("stats:global", expect.anything());
    });

    it("computes and stores global metrics on a cache miss", async () => {
      (getDeals as jest.Mock).mockReturnValue([deal()]);
      const result = await getCachedGlobalMetrics();
      expect(result.dealCount).toBe(1);
      expect(setJson).toHaveBeenCalledWith("stats:global", expect.objectContaining({ dealCount: 1 }));
    });

    it("throws when a neighborhood is unknown", async () => {
      (getDeals as jest.Mock).mockReturnValue([deal()]);
      await expect(getCachedNeighborhood("כרמל")).rejects.toBeInstanceOf(NotFoundError);
    });

    it("returns cached neighborhood stats when present", async () => {
      (getDeals as jest.Mock).mockReturnValue([deal()]);
      const cached = { neighborhood: "פלורנטין" } as NeighborhoodStats;
      (getJson as jest.Mock).mockResolvedValue(cached);
      await expect(getCachedNeighborhood("פלורנטין")).resolves.toEqual(cached);
      expect(setJson).not.toHaveBeenCalled();
    });

    it("computes and stores neighborhood stats on a cache miss", async () => {
      (getDeals as jest.Mock).mockReturnValue([deal()]);
      const stats = await getCachedNeighborhood("פלורנטין");
      expect(stats.neighborhood).toBe("פלורנטין");
      expect(setJson).toHaveBeenCalled();
    });
  });

  describe("evaluateSubject", () => {
    it("requires dealId or neighborhood", async () => {
      await expect(evaluateSubject({})).rejects.toBeInstanceOf(ValidationError);
    });

    it("throws when the deal does not exist", async () => {
      (findDealById as jest.Mock).mockReturnValue(undefined);
      await expect(evaluateSubject({ dealId: "missing" })).rejects.toBeInstanceOf(NotFoundError);
    });

    it("evaluates a known deal", async () => {
      const target = deal();
      (findDealById as jest.Mock).mockReturnValue(target);
      (getDeals as jest.Mock).mockReturnValue([target]);
      (insightFromDealMetrics as jest.Mock).mockResolvedValue(evaluation);
      await expect(evaluateSubject({ dealId: "A-1" })).resolves.toEqual(evaluation);
      expect(insightFromDealMetrics).toHaveBeenCalled();
      expect(setJson).toHaveBeenCalledWith(
        "stats:neighborhood:תל אביב:פלורנטין",
        expect.objectContaining({ neighborhood: "פלורנטין" }),
      );
    });

    it("evaluates a neighborhood", async () => {
      (getDeals as jest.Mock).mockReturnValue([deal()]);
      (insightFromNeighborhood as jest.Mock).mockResolvedValue(evaluation);
      await expect(evaluateSubject({ neighborhood: "פלורנטין" })).resolves.toEqual(evaluation);
      expect(insightFromNeighborhood).toHaveBeenCalled();
    });
  });
});
