import { LlmTimeoutError, LlmUnavailableError } from "../../src/services/llm/ollamaClient";
import {
  dealStatsPayload,
  evaluateInsight,
  insightFromDealMetrics,
  insightFromNeighborhood,
  neighborhoodStatsPayload,
} from "../../src/services/llm/insightService";
import type { Deal, DealValuationMetrics, LlmInsight, NeighborhoodStats } from "../../src/types/domain";

const fallbackInsight: LlmInsight = {
  summary: "גיבוי דטרמיניסטי",
  opportunityScore: 55,
  verdict: "hold",
  pros: ["יתרון א", "יתרון ב"],
  cons: ["חיסרון א", "חיסרון ב"],
  risks: ["סיכון"],
  buyerTips: ["טיפ א", "טיפ ב"],
  marketNarrative: "נרטיב",
};

const llmInsight: LlmInsight = {
  summary: "ניתוח מודל מקומי על בסיס הסטטיסטיקה שסופקה בלבד.",
  opportunityScore: 58,
  verdict: "hold",
  pros: ["המחיר למ״ר נמוך מהממוצע", "מגמת CAGR חיובית"],
  cons: ["מדגם מוגבל", "אין מידע על מצב פיזי"],
  risks: ["ריבית"],
  buyerTips: ["בדקו שמאי", "השוו לרחוב"],
  marketNarrative: "השכונה יציבה לפי הנתונים שסופקו.",
};

jest.mock("../../src/services/llm/ollamaClient", () => {
  const actual = jest.requireActual("../../src/services/llm/ollamaClient");
  return {
    ...actual,
    completeJsonChat: jest.fn(),
  };
});

jest.mock("../../src/services/cache/cacheService", () => ({
  getJson: jest.fn().mockResolvedValue(null),
  setJson: jest.fn().mockResolvedValue(undefined),
  insightKey: jest.fn(() => "insight:test"),
}));

import { completeJsonChat } from "../../src/services/llm/ollamaClient";
import { getJson, setJson } from "../../src/services/cache/cacheService";

const mockedChat = completeJsonChat as jest.MockedFunction<typeof completeJsonChat>;
const mockedGet = getJson as jest.MockedFunction<typeof getJson>;
const mockedSet = setJson as jest.MockedFunction<typeof setJson>;

const deal: Deal = {
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
};

const dealMetrics: DealValuationMetrics = {
  deal,
  streetAvgPricePerSqm: 31000,
  neighborhoodAvgPricePerSqm: 32000,
  varianceVsStreetPct: -3.2,
  varianceVsNeighborhoodPct: -6.25,
  neighborhoodCagrPct: 4.1,
  neighborhoodStddevPricePerSqm: 1800,
  opportunityScore: 61,
};

const neighborhood: NeighborhoodStats = {
  city: "תל אביב",
  neighborhood: "פלורנטין",
  dealCount: 10,
  price: { count: 10, mean: 2_200_000, median: 2_100_000, stddev: 300_000, min: 1_500_000, max: 3_000_000 },
  pricePerSqm: { count: 10, mean: 32000, median: 31000, stddev: 2000, min: 27000, max: 38000 },
  avgRooms: 3.2,
  avgSqm: 75,
  historicalCagrPct: 5,
  trend: [{ year: 2024, dealCount: 10, avgPricePerSqm: 32000, avgPriceNis: 2_200_000, yoyGrowthPct: null }],
  streets: [{ street: "הרצל", dealCount: 10, avgPricePerSqm: 31000, medianPricePerSqm: 30500, avgPriceNis: 2_100_000 }],
  dataConfidence: 55,
};

describe("insight service fallback handling", () => {
  beforeEach(() => {
    mockedChat.mockReset();
    mockedGet.mockReset();
    mockedSet.mockReset();
    mockedGet.mockResolvedValue(null);
    mockedSet.mockResolvedValue(undefined);
  });

  const args = {
    kind: "neighborhood" as const,
    subject: { neighborhood: "פלורנטין", city: "תל אביב" },
    stats: { neighborhood: "פלורנטין", calculatedOpportunityScore: 55 },
    calculatedOpportunityScore: 55,
    fallbackInsight,
  };

  it("returns schema-valid LLM JSON when Ollama succeeds", async () => {
    mockedChat.mockResolvedValue(JSON.stringify(llmInsight));
    const result = await evaluateInsight(args);
    expect(result.insightSource).toBe("llm");
    expect(result.fallbackUsed).toBe(false);
    expect(result.metricsSource).toBe("calculated");
    expect(result.cached).toBe(false);
    expect(result.insight.summary).toContain("סטטיסטיקה");
    expect(mockedSet).toHaveBeenCalled();
  });

  it("parses markdown-fenced JSON from the model", async () => {
    mockedChat.mockResolvedValue("```json\n" + JSON.stringify(llmInsight) + "\n```");
    const result = await evaluateInsight(args);
    expect(result.insightSource).toBe("llm");
    expect(result.insight.verdict).toBe("hold");
  });

  it("labels a deal subject in the prompt sent to the model", async () => {
    mockedChat.mockResolvedValue(JSON.stringify(llmInsight));
    await evaluateInsight({
      ...args,
      kind: "deal",
      subject: { dealId: "A-1", neighborhood: "פלורנטין", city: "תל אביב" },
    });
    const prompt = mockedChat.mock.calls[0][0];
    expect(prompt.user).toContain("A-1");
    expect(prompt.user).toContain("פלורנטין");
  });

  it("labels incomplete subjects without inventing location names", async () => {
    mockedChat.mockResolvedValue(JSON.stringify(llmInsight));
    await evaluateInsight({ ...args, kind: "deal", subject: { dealId: "Z-9" } });
    expect(mockedChat.mock.calls[0][0].user).toContain("Z-9");

    await evaluateInsight({ ...args, subject: {} });
    expect(mockedChat.mock.calls[1][0].user).toContain("שכונה");
  });

  it("falls back on timeout without throwing", async () => {
    mockedChat.mockRejectedValue(new LlmTimeoutError(30000));
    const result = await evaluateInsight(args);
    expect(result.insightSource).toBe("fallback");
    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toBe("timeout");
    expect(result.insight.summary).toBe("גיבוי דטרמיניסטי");
    expect(mockedSet).not.toHaveBeenCalled();
  });

  it("falls back on malformed JSON", async () => {
    mockedChat.mockResolvedValue("this is not json at all");
    const result = await evaluateInsight(args);
    expect(result.fallbackUsed).toBe(true);
    expect(result.insightSource).toBe("fallback");
    expect(result.fallbackReason).toBe("invalid_json");
  });

  it("falls back when JSON is valid but fails the insight schema", async () => {
    mockedChat.mockResolvedValue(JSON.stringify({ summary: "too short" }));
    const result = await evaluateInsight(args);
    expect(result.fallbackUsed).toBe(true);
    expect(result.insight).toEqual(fallbackInsight);
    expect(result.fallbackReason).toBe("invalid_json");
  });

  it("falls back on LLM unavailability and unknown errors", async () => {
    mockedChat.mockRejectedValue(new LlmUnavailableError("down"));
    await expect(evaluateInsight(args)).resolves.toMatchObject({
      fallbackUsed: true,
      fallbackReason: "unavailable",
    });
    mockedChat.mockRejectedValue("boom");
    await expect(evaluateInsight(args)).resolves.toMatchObject({ insightSource: "fallback" });
  });

  it("labels a missing Ollama model as model_missing", async () => {
    mockedChat.mockRejectedValue(
      new LlmUnavailableError('OLLAMA_HTTP_404:{"error":"model \'llama3:8b\' not found"}'),
    );
    await expect(evaluateInsight(args)).resolves.toMatchObject({
      fallbackUsed: true,
      fallbackReason: "model_missing",
    });
    expect(mockedSet).not.toHaveBeenCalled();
  });

  it("returns cached insight without calling the model", async () => {
    mockedGet.mockResolvedValue({
      metricsSource: "calculated",
      insightSource: "llm",
      fallbackUsed: false,
      cached: false,
      generatedAt: "2025-01-01T00:00:00.000Z",
      subject: args.subject,
      stats: args.stats,
      insight: llmInsight,
    });
    const result = await evaluateInsight(args);
    expect(result.cached).toBe(true);
    expect(mockedChat).not.toHaveBeenCalled();
  });

  it("ignores a cached fallback and retries the model", async () => {
    mockedGet.mockResolvedValue({
      metricsSource: "calculated",
      insightSource: "fallback",
      fallbackUsed: true,
      fallbackReason: "model_missing",
      cached: false,
      generatedAt: "2025-01-01T00:00:00.000Z",
      subject: args.subject,
      stats: args.stats,
      insight: fallbackInsight,
    });
    mockedChat.mockResolvedValue(JSON.stringify(llmInsight));
    const result = await evaluateInsight(args);
    expect(result.insightSource).toBe("llm");
    expect(result.cached).toBe(false);
    expect(mockedChat).toHaveBeenCalled();
  });

  it("rejects stats payloads that contain raw rows", async () => {
    await expect(evaluateInsight({ ...args, stats: { deals: [] } })).rejects.toThrow(/RAW_ROWS/);
    expect(mockedChat).not.toHaveBeenCalled();
  });
});

describe("insight payload helpers", () => {
  beforeEach(() => {
    mockedChat.mockReset();
    mockedGet.mockReset();
    mockedSet.mockReset();
    mockedGet.mockResolvedValue(null);
    mockedSet.mockResolvedValue(undefined);
  });

  it("builds a deal stats payload without raw rows", () => {
    const payload = dealStatsPayload(dealMetrics);
    expect(payload.dealId).toBe("A-1");
    expect(payload.pricePerSqm).toBe(30000);
    expect(payload.calculatedOpportunityScore).toBe(61);
    expect(payload).not.toHaveProperty("deals");
    expect(payload).not.toHaveProperty("rows");
  });

  it("builds a neighborhood stats payload with street rollups", () => {
    const payload = neighborhoodStatsPayload(neighborhood);
    expect(payload.neighborhood).toBe("פלורנטין");
    expect(payload.dealCount).toBe(10);
    expect(Array.isArray(payload.streets)).toBe(true);
    expect(typeof payload.calculatedOpportunityScore).toBe("number");
  });

  it("evaluates deal and neighborhood wrappers through the insight pipeline", async () => {
    mockedGet.mockResolvedValue(null);
    mockedSet.mockResolvedValue(undefined);
    mockedChat.mockResolvedValue(JSON.stringify(llmInsight));
    const dealResult = await insightFromDealMetrics(dealMetrics);
    expect(dealResult.subject.dealId).toBe("A-1");
    expect(dealResult.insightSource).toBe("llm");

    const hoodResult = await insightFromNeighborhood(neighborhood);
    expect(hoodResult.subject.neighborhood).toBe("פלורנטין");
    expect(hoodResult.stats).toHaveProperty("calculatedOpportunityScore");
  });
});
