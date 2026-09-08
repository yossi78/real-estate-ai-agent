import { extractJsonObject, parseLlmInsight } from "../../src/services/llm/schema";
import type { LlmInsight } from "../../src/types/domain";

const valid: LlmInsight = {
  summary: "ניתוח מבוסס נתונים על העסקה והשכונה.",
  opportunityScore: 58.456,
  verdict: "hold",
  pros: ["המחיר למ״ר נמוך מהממוצע", "מגמת CAGR חיובית"],
  cons: ["מדגם מוגבל", "אין מידע על מצב פיזי"],
  risks: ["ריבית"],
  buyerTips: ["בדקו שמאי", "השוו לרחוב"],
  marketNarrative: "השכונה יציבה לפי הנתונים שסופקו.",
};

describe("parseLlmInsight", () => {
  it("accepts a schema-valid object and rounds the score", () => {
    const parsed = parseLlmInsight(valid);
    expect(parsed.opportunityScore).toBe(58.46);
    expect(parsed.verdict).toBe("hold");
  });

  it("rejects missing fields, short text, illegal verdicts, and too-short lists", () => {
    expect(() => parseLlmInsight({})).toThrow();
    expect(() => parseLlmInsight({ ...valid, summary: "קצר" })).toThrow();
    expect(() => parseLlmInsight({ ...valid, verdict: "maybe" })).toThrow();
    expect(() => parseLlmInsight({ ...valid, opportunityScore: 120 })).toThrow();
    expect(() => parseLlmInsight({ ...valid, opportunityScore: -1 })).toThrow();
  });

  it("replaces dash placeholders and pads short lists", () => {
    const parsed = parseLlmInsight({
      ...valid,
      cons: ["-", "-"],
      risks: [],
      buyerTips: ["ab"],
      opportunityScore: "58.456",
    });
    expect(parsed.cons[0]).toBe("אין פירוט נוסף בנתונים");
    expect(parsed.risks).toEqual(["אין פירוט נוסף בנתונים"]);
    expect(parsed.buyerTips[0]).toBe("אין פירוט נוסף בנתונים");
    expect(parsed.opportunityScore).toBe(58.46);
  });
});

describe("extractJsonObject", () => {
  it("parses a plain JSON object", () => {
    expect(extractJsonObject(JSON.stringify({ a: 1 }))).toEqual({ a: 1 });
  });

  it("extracts JSON from markdown fences and surrounding text", () => {
    expect(extractJsonObject("```json\n{\"ok\":true}\n```")).toEqual({ ok: true });
    expect(extractJsonObject("```\n{\"ok\":true}\n```")).toEqual({ ok: true });
    expect(extractJsonObject('prefix {"ok":true} suffix')).toEqual({ ok: true });
    expect(extractJsonObject('"{\\"ok\\":true}"')).toEqual({ ok: true });
    expect(extractJsonObject(`{"summary":"70 מ${'"'}ר"}`)).toEqual({ summary: "70 מטר רבוע" });
    expect(extractJsonObject('{"summary":"דירה 70 מ", "verdict":"hold"}')).toEqual({
      summary: "דירה 70 מטר",
      verdict: "hold",
    });
    expect(
      extractJsonObject('note {"summary":"עסקה יציבה יחסית","verdict":"hold","marketNarrative":"צמיחה'),
    ).toMatchObject({
      summary: "עסקה יציבה יחסית",
      verdict: "hold",
    });
    expect(() => extractJsonObject("[1,2,3]")).toThrow("NO_JSON_OBJECT");
  });

  it("throws when no JSON object is present or the payload is invalid JSON", () => {
    expect(() => extractJsonObject("no braces here")).toThrow("NO_JSON_OBJECT");
    expect(() => extractJsonObject("}{")).toThrow("NO_JSON_OBJECT");
    expect(() => extractJsonObject("{")).toThrow("NO_JSON_OBJECT");
    expect(() => extractJsonObject("{not json}")).toThrow();
  });
});
