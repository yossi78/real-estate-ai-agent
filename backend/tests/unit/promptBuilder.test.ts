import { assertNoRawRows, buildInsightPrompt, LLM_TEMPERATURE } from "../../src/services/llm/promptBuilder";

jest.mock("../../src/config/env", () => ({
  env: { ollamaTemperature: 0 },
}));

describe("prompt builder", () => {
  const stats = {
    neighborhood: "פלורנטין",
    pricePerSqm: { mean: 32000, median: 31000 },
    varianceVsNeighborhoodPct: -9.4,
    historicalCagrPct: 6.1,
    calculatedOpportunityScore: 64,
  };

  it("embeds aggregated stats and forbids number invention", () => {
    const prompt = buildInsightPrompt({
      calculatedOpportunityScore: 64,
      subjectLabel: "עסקה X בפלורנטין",
      stats,
    });
    expect(prompt.format).toBe("json");
    expect(prompt.temperature).toBe(LLM_TEMPERATURE);
    expect(prompt.system).toContain("אסור להמציא");
    expect(prompt.system).toContain("JSON");
    expect(prompt.system).toContain("מטר רבוע");
    expect(prompt.system).toContain("משפט עברי מלא");
    expect(prompt.system).toContain("סכימה");
    expect(prompt.system).toContain("opportunityScore");
    expect(prompt.system).toContain("verdict");
    expect(prompt.user).toContain("פלורנטין");
    expect(prompt.user).toContain("calculatedOpportunityScore");
    expect(prompt.user).not.toMatch(/"rows"/);
    expect(JSON.parse(prompt.user).stats).toEqual(stats);
  });

  it("rejects raw row dumps in the stats payload regardless of key case", () => {
    expect(() => assertNoRawRows({ deals: [] })).toThrow(/RAW_ROWS/);
    expect(() => assertNoRawRows({ rows: [] })).toThrow(/RAW_ROWS/);
    expect(() => assertNoRawRows({ RAW: [] })).toThrow(/RAW_ROWS/);
    expect(() => assertNoRawRows({ transactions: [] })).toThrow(/RAW_ROWS/);
    expect(() => assertNoRawRows({ csv: "dump" })).toThrow(/RAW_ROWS/);
    expect(() => assertNoRawRows(stats)).not.toThrow();
  });
});
