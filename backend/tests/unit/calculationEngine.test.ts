import {
  computeCagrFromDeals,
  computeGlobalMetrics,
  computeNeighborhoodStats,
  evaluateDeal,
  findNeighborhoodStats,
  scoreOpportunity,
  toNeighborhoodStats,
  toYearlyTrend,
} from "../../src/services/stats/calculationEngine";
import { cagr, percentVariance } from "../../src/services/stats/math";
import type { Deal } from "../../src/types/domain";

function deal(partial: Partial<Deal> & Pick<Deal, "dealId" | "year" | "street" | "priceNis" | "sqm">): Deal {
  const pricePerSqm = partial.priceNis / partial.sqm;
  return {
    date: `${partial.year}-06-01`,
    city: "תל אביב",
    neighborhood: "רמת אביב",
    rooms: 4,
    floor: 3,
    propertyType: "דירה",
    yearBuilt: 2000,
    pricePerSqm,
    ...partial,
  };
}

const corpus: Deal[] = [
  deal({ dealId: "a", year: 2020, street: "ברודצקי", priceNis: 2_000_000, sqm: 100 }),
  deal({ dealId: "b", year: 2020, street: "ברודצקי", priceNis: 2_200_000, sqm: 100 }),
  deal({ dealId: "c", year: 2022, street: "קקל", priceNis: 2_420_000, sqm: 100 }),
  deal({ dealId: "d", year: 2024, street: "קקל", priceNis: 2_662_000, sqm: 100 }),
  deal({ dealId: "cheap", year: 2024, street: "ברודצקי", priceNis: 1_800_000, sqm: 100 }),
];

describe("aggregation", () => {
  it("builds yearly trend with YoY growth", () => {
    const trend = toYearlyTrend(corpus);
    expect(trend.map((t) => t.year)).toEqual([2020, 2022, 2024]);
    expect(trend[0].yoyGrowthPct).toBeNull();
    expect(trend[1].yoyGrowthPct).toBe(percentVariance(24_200, 21_000));
    expect(trend[0].dealCount).toBe(2);
  });

  it("returns an empty trend and null CAGR for a single year or empty corpus", () => {
    expect(toYearlyTrend([])).toEqual([]);
    expect(computeCagrFromDeals([])).toBeNull();
    expect(computeCagrFromDeals(corpus.filter((d) => d.year === 2020))).toBeNull();
  });

  it("computes neighborhood CAGR from first to last year", () => {
    const growth = computeCagrFromDeals(corpus);
    expect(growth).toBeCloseTo(cagr(21_000, 22_310, 4) as number);
  });

  it("aggregates street stats under a neighborhood", () => {
    const [stats] = computeNeighborhoodStats(corpus);
    expect(stats.neighborhood).toBe("רמת אביב");
    expect(stats.dealCount).toBe(5);
    expect(stats.streets).toHaveLength(2);
    expect(stats.streets[0].dealCount).toBeGreaterThanOrEqual(stats.streets[1].dealCount);
    expect(stats.pricePerSqm.mean).toBeGreaterThan(0);
    expect(stats.avgRooms).toBe(4);
    expect(stats.avgSqm).toBe(100);
    expect(stats.dataConfidence).toBeGreaterThan(0);
    expect(stats.dataConfidence).toBeLessThanOrEqual(100);
  });

  it("groups multiple neighborhoods and sorts by deal count", () => {
    const mixed = [
      ...corpus,
      deal({ dealId: "f1", year: 2024, street: "הרצל", priceNis: 2_000_000, sqm: 80, neighborhood: "פלורנטין" }),
    ];
    const stats = computeNeighborhoodStats(mixed);
    expect(stats.map((s) => s.neighborhood)).toEqual(["רמת אביב", "פלורנטין"]);
    expect(stats[0].dealCount).toBeGreaterThan(stats[1].dealCount);
  });

  it("finds neighborhood stats case-insensitively and ignores surrounding spaces", () => {
    expect(findNeighborhoodStats(corpus, "  רמת אביב  ")?.dealCount).toBe(5);
    expect(findNeighborhoodStats(corpus, "פלורנטין")).toBeUndefined();
  });

  it("computes global metrics across the corpus", () => {
    const global = computeGlobalMetrics(corpus);
    expect(global.dealCount).toBe(5);
    expect(global.cities).toEqual(["תל אביב"]);
    expect(global.neighborhoods).toHaveLength(1);
    expect(global.price.count).toBe(5);
    expect(global.pricePerSqm.mean).toBeGreaterThan(0);
    expect(global.historicalCagrPct).not.toBeNull();
  });

  it("handles an empty corpus in global metrics", () => {
    const global = computeGlobalMetrics([]);
    expect(global.dealCount).toBe(0);
    expect(global.cities).toEqual([]);
    expect(global.neighborhoods).toEqual([]);
    expect(global.historicalCagrPct).toBeNull();
  });

  it("raises data confidence with more deals and more years", () => {
    const sparse = toNeighborhoodStats([corpus[0]]);
    const dense = toNeighborhoodStats(corpus);
    expect(dense.dataConfidence).toBeGreaterThan(sparse.dataConfidence);
  });
});

describe("deal evaluation", () => {
  it("flags a cheap deal vs neighborhood average", () => {
    const target = corpus.find((d) => d.dealId === "cheap") as Deal;
    const metrics = evaluateDeal(target, corpus);
    expect(metrics.varianceVsNeighborhoodPct).not.toBeNull();
    expect(metrics.varianceVsNeighborhoodPct as number).toBeLessThan(0);
    expect(metrics.opportunityScore).toBeGreaterThan(50);
    expect(metrics.streetAvgPricePerSqm).not.toBeNull();
    expect(metrics.neighborhoodAvgPricePerSqm).not.toBeNull();
  });

  it("returns null street/neighborhood baselines when the deal is isolated", () => {
    const outsider = deal({
      dealId: "out",
      year: 2024,
      street: "אלמוני",
      priceNis: 2_000_000,
      sqm: 100,
      city: "חיפה",
      neighborhood: "כרמל",
    });
    const metrics = evaluateDeal(outsider, corpus);
    expect(metrics.streetAvgPricePerSqm).toBeNull();
    expect(metrics.neighborhoodAvgPricePerSqm).toBeNull();
    expect(metrics.varianceVsStreetPct).toBeNull();
    expect(metrics.varianceVsNeighborhoodPct).toBeNull();
    expect(metrics.neighborhoodCagrPct).toBeNull();
  });

  it("computes street average as null when only the neighborhood matches", () => {
    const otherStreet = deal({
      dealId: "other-st",
      year: 2024,
      street: "רחוב חדש",
      priceNis: 2_000_000,
      sqm: 100,
    });
    const metrics = evaluateDeal(otherStreet, corpus);
    expect(metrics.streetAvgPricePerSqm).toBeNull();
    expect(metrics.neighborhoodAvgPricePerSqm).not.toBeNull();
  });
});

describe("opportunity score", () => {
  it("scores discounts higher than premiums", () => {
    const cheap = scoreOpportunity({
      varianceVsNeighborhoodPct: -12,
      cagrPct: 5,
      stddev: 1000,
      meanPpsqm: 20000,
      sampleSize: 15,
    });
    const expensive = scoreOpportunity({
      varianceVsNeighborhoodPct: 18,
      cagrPct: 5,
      stddev: 1000,
      meanPpsqm: 20000,
      sampleSize: 15,
    });
    expect(cheap).toBeGreaterThan(expensive);
  });

  it("penalizes small samples and rewards larger ones", () => {
    const base = {
      varianceVsNeighborhoodPct: 0,
      cagrPct: 0,
      stddev: 0,
      meanPpsqm: 20000,
    };
    const small = scoreOpportunity({ ...base, sampleSize: 4 });
    const mid = scoreOpportunity({ ...base, sampleSize: 8 });
    const large = scoreOpportunity({ ...base, sampleSize: 12 });
    expect(small).toBe(42);
    expect(mid).toBe(50);
    expect(large).toBe(54);
  });

  it("treats null variance/CAGR as zero and ignores cv when mean ppsqm is 0", () => {
    expect(
      scoreOpportunity({
        varianceVsNeighborhoodPct: null,
        cagrPct: null,
        stddev: 999,
        meanPpsqm: 0,
        sampleSize: 8,
      }),
    ).toBe(50);
  });

  it("clamps extreme scores into 0–100", () => {
    expect(
      scoreOpportunity({
        varianceVsNeighborhoodPct: 80,
        cagrPct: -20,
        stddev: 20_000,
        meanPpsqm: 20_000,
        sampleSize: 1,
      }),
    ).toBe(0);
    expect(
      scoreOpportunity({
        varianceVsNeighborhoodPct: -80,
        cagrPct: 40,
        stddev: 0,
        meanPpsqm: 20_000,
        sampleSize: 20,
      }),
    ).toBe(99);
  });
});
