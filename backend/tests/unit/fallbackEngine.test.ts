import { fallbackFromDeal, fallbackFromNeighborhood, verdictFromVariance } from "../../src/services/llm/fallbackEngine";
import type { Deal, DealValuationMetrics, NeighborhoodStats } from "../../src/types/domain";

const deal: Deal = {
  dealId: "TLV-CHEAP",
  date: "2024-01-01",
  year: 2024,
  city: "תל אביב",
  neighborhood: "פלורנטין",
  street: "הרצל",
  rooms: 3,
  floor: 2,
  sqm: 70,
  priceNis: 1_800_000,
  pricePerSqm: 25714.29,
  propertyType: "דירה",
  yearBuilt: 1960,
};

function metrics(overrides: Partial<DealValuationMetrics> = {}): DealValuationMetrics {
  return {
    deal,
    streetAvgPricePerSqm: 30000,
    neighborhoodAvgPricePerSqm: 31000,
    varianceVsStreetPct: -14.3,
    varianceVsNeighborhoodPct: -17,
    neighborhoodCagrPct: 5,
    neighborhoodStddevPricePerSqm: 2000,
    opportunityScore: 72,
    ...overrides,
  };
}

function neighborhood(overrides: Partial<NeighborhoodStats> = {}): NeighborhoodStats {
  return {
    city: "תל אביב",
    neighborhood: "רמת אביב",
    dealCount: 12,
    price: { count: 12, mean: 3_000_000, median: 2_900_000, stddev: 400_000, min: 1_800_000, max: 4_400_000 },
    pricePerSqm: { count: 12, mean: 32000, median: 31000, stddev: 2500, min: 27000, max: 38000 },
    avgRooms: 3.8,
    avgSqm: 98,
    historicalCagrPct: 6.2,
    trend: [],
    streets: [{ street: "ברודצקי", dealCount: 6, avgPricePerSqm: 33000, medianPricePerSqm: 32500, avgPriceNis: 3_100_000 }],
    dataConfidence: 74,
    ...overrides,
  };
}

describe("verdictFromVariance", () => {
  it("maps strong discounts to buy when CAGR is missing or not sharply negative", () => {
    expect(verdictFromVariance(-12, 3)).toBe("buy");
    expect(verdictFromVariance(-10, null)).toBe("buy");
    expect(verdictFromVariance(-10, -1)).toBe("buy");
  });

  it("does not buy when a large discount coincides with a sharply negative CAGR", () => {
    expect(verdictFromVariance(-10, -2)).toBe("hold");
  });

  it("maps premiums and declining neighborhoods to avoid", () => {
    expect(verdictFromVariance(16, 3)).toBe("avoid");
    expect(verdictFromVariance(15, 0)).toBe("avoid");
    expect(verdictFromVariance(5, -4)).toBe("avoid");
    expect(verdictFromVariance(4, -4)).toBe("hold");
  });

  it("holds near-average pricing", () => {
    expect(verdictFromVariance(2, 3)).toBe("hold");
    expect(verdictFromVariance(14, 3)).toBe("hold");
  });
});

describe("fallbackFromDeal", () => {
  it("produces Hebrew rule-based deal insight for a discounted buy", () => {
    const insight = fallbackFromDeal(metrics());
    expect(insight.verdict).toBe("buy");
    expect(insight.opportunityScore).toBe(72);
    expect(insight.summary).toContain("TLV-CHEAP");
    expect(insight.summary).toContain("זולה");
    expect(insight.pros.some((p) => p.includes("מתחת לממוצע"))).toBe(true);
    expect(insight.pros.some((p) => p.includes("הרצל"))).toBe(true);
    expect(insight.cons.some((c) => c.includes("מצב פיזי"))).toBe(true);
    expect(insight.cons.some((c) => c.includes("נזילות"))).toBe(true);
    expect(insight.risks[0]).toContain("סיכון מקרו");
    expect(insight.buyerTips.some((t) => t.includes("שמאי"))).toBe(true);
    expect(insight.marketNarrative).toContain("₪");
    expect(insight.marketNarrative).toContain("CAGR");
  });

  it("handles missing CAGR, expensive deals, and avoid tips", () => {
    const insight = fallbackFromDeal(
      metrics({
        varianceVsNeighborhoodPct: 18,
        neighborhoodCagrPct: null,
        opportunityScore: 38,
      }),
    );
    expect(insight.verdict).toBe("avoid");
    expect(insight.summary).toContain("יקרה");
    expect(insight.cons.some((c) => c.includes("יקר"))).toBe(true);
    expect(insight.cons.some((c) => c.includes("היסטוריה"))).toBe(true);
    expect(insight.buyerTips.some((t) => t.includes("פרמיית"))).toBe(true);
  });

  it("covers hold copy, negative CAGR, high volatility, and missing street discount", () => {
    const insight = fallbackFromDeal(
      metrics({
        varianceVsNeighborhoodPct: 3,
        varianceVsStreetPct: 1,
        neighborhoodCagrPct: -2,
        neighborhoodStddevPricePerSqm: 8000,
        opportunityScore: 48,
      }),
    );
    expect(insight.verdict).toBe("hold");
    expect(insight.pros.some((p) => p.includes("25714") || p.includes("מ״ר"))).toBe(true);
    expect(insight.pros.some((p) => p.includes("השוואה סטטיסטית"))).toBe(true);
    expect(insight.cons.some((c) => c.includes("שלילי"))).toBe(true);
    expect(insight.risks[0]).toContain("סטיית תקן");
    expect(insight.buyerTips.some((t) => t.includes("קרובה לממוצע"))).toBe(true);
  });

  it("renders unavailable baselines in the summary and narrative", () => {
    const insight = fallbackFromDeal(
      metrics({
        varianceVsNeighborhoodPct: null,
        streetAvgPricePerSqm: null,
        neighborhoodAvgPricePerSqm: null,
        neighborhoodCagrPct: null,
        opportunityScore: 50,
      }),
    );
    expect(insight.summary).toContain("אין מספיק בסיס שכונתי");
    expect(insight.marketNarrative).toContain("לא זמין");
    expect(insight.marketNarrative).toContain("לא חושבה");
  });
});

describe("fallbackFromNeighborhood", () => {
  it("summarizes a growing low-volatility neighborhood as buy", () => {
    const insight = fallbackFromNeighborhood(neighborhood());
    expect(insight.summary).toContain("רמת אביב");
    expect(insight.verdict).toBe("buy");
    expect(insight.opportunityScore).toBeGreaterThan(50);
    expect(insight.pros[1]).toContain("ברודצקי");
    expect(insight.cons.some((c) => c.includes("לא מדווחים"))).toBe(true);
  });

  it("marks shrinking neighborhoods as avoid", () => {
    const insight = fallbackFromNeighborhood(neighborhood({ historicalCagrPct: -5, dealCount: 12 }));
    expect(insight.verdict).toBe("avoid");
  });

  it("holds when growth is modest or volatility is high", () => {
    expect(fallbackFromNeighborhood(neighborhood({ historicalCagrPct: 2 })).verdict).toBe("hold");
    expect(
      fallbackFromNeighborhood(
        neighborhood({
          historicalCagrPct: 6,
          pricePerSqm: { count: 12, mean: 32000, median: 31000, stddev: 9000, min: 27000, max: 38000 },
        }),
      ).verdict,
    ).toBe("hold");
  });

  it("treats a zero mean ppsqm as zero coefficient of variation", () => {
    const insight = fallbackFromNeighborhood(
      neighborhood({
        historicalCagrPct: 4,
        pricePerSqm: { count: 2, mean: 0, median: 0, stddev: 10, min: 0, max: 0 },
      }),
    );
    expect(insight.verdict).toBe("buy");
    expect(insight.risks[0]).toContain("סיכון ריבית");
  });

  it("covers small samples, missing streets, missing CAGR, and high CV risk copy", () => {
    const insight = fallbackFromNeighborhood(
      neighborhood({
        dealCount: 3,
        historicalCagrPct: null,
        streets: [],
        pricePerSqm: { count: 3, mean: 32000, median: 31000, stddev: 9000, min: 27000, max: 38000 },
        dataConfidence: 20,
      }),
    );
    expect(insight.verdict).toBe("hold");
    expect(insight.summary).toContain("אין CAGR");
    expect(insight.pros[1]).toContain("פירוט רחובות");
    expect(insight.cons.some((c) => c.includes("מדגם קטן"))).toBe(true);
    expect(insight.cons.some((c) => c.includes("אין עומק"))).toBe(true);
    expect(insight.risks[0]).toContain("תנודתיות");
  });
});
