import { z } from "zod";
import type { LlmInsight, Verdict } from "../../types/domain";

export const llmInsightSchema = z.object({
  summary: z.string().min(8).max(1200),
  opportunityScore: z.number().min(0).max(100),
  verdict: z.enum(["buy", "hold", "avoid"]) as z.ZodType<Verdict>,
  pros: z.array(z.string().min(3)).min(2).max(6),
  cons: z.array(z.string().min(3)).min(1).max(6),
  risks: z.array(z.string().min(3)).min(1).max(6),
  buyerTips: z.array(z.string().min(3)).min(1).max(6),
  marketNarrative: z.string().min(8).max(1500),
});

export const LLM_JSON_SCHEMA_DESCRIPTION = `{
  "summary": "string — 2-4 Hebrew sentences, facts only from the payload",
  "opportunityScore": "number 0-100, must stay within ±8 of provided calculatedOpportunityScore",
  "verdict": "buy | hold | avoid",
  "pros": ["string", "string"],
  "cons": ["string", "string"],
  "risks": ["string"],
  "buyerTips": ["string", "string"],
  "marketNarrative": "string — Hebrew market read grounded in the numbers"
}`;

export const LLM_OUTPUT_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    opportunityScore: { type: "number" },
    verdict: { type: "string", enum: ["buy", "hold", "avoid"] },
    pros: { type: "array", items: { type: "string" } },
    cons: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    buyerTips: { type: "array", items: { type: "string" } },
    marketNarrative: { type: "string" },
  },
  required: [
    "summary",
    "opportunityScore",
    "verdict",
    "pros",
    "cons",
    "risks",
    "buyerTips",
    "marketNarrative",
  ],
} as const;

const LIST_PLACEHOLDER = "אין פירוט נוסף בנתונים";

export function parseLlmInsight(raw: unknown): LlmInsight {
  const parsed = llmInsightSchema.parse(coerceInsightShape(raw));
  return {
    ...parsed,
    opportunityScore: Math.round(parsed.opportunityScore * 100) / 100,
  };
}

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = sanitizeLlmJson(fenced ? fenced[1].trim() : trimmed);
  const attempts = [candidate];
  if (candidate.includes("{") && candidate.length > 12) {
    attempts.push(closeDanglingJson(candidate));
  }

  for (const attempt of attempts) {
    const parsed = tryParseObject(attempt);
    if (parsed) return parsed;
  }

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const sliced = candidate.slice(start, end + 1);
    const parsed = tryParseObject(sliced) ?? tryParseObject(closeDanglingJson(sliced));
    if (parsed) return parsed;
  }

  if (start !== -1 && candidate.length > 12) {
    const parsed = tryParseObject(closeDanglingJson(candidate.slice(start)));
    if (parsed) return parsed;
  }

  throw new Error("NO_JSON_OBJECT");
}

function coerceInsightShape(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const o = raw as Record<string, unknown>;
  return {
    ...o,
    opportunityScore: Number(o.opportunityScore),
    summary: typeof o.summary === "string" ? o.summary.trim() : o.summary,
    marketNarrative: typeof o.marketNarrative === "string" ? o.marketNarrative.trim() : o.marketNarrative,
    verdict: typeof o.verdict === "string" ? o.verdict.trim().toLowerCase() : o.verdict,
    pros: cleanList(o.pros, 2),
    cons: cleanList(o.cons, 1),
    risks: cleanList(o.risks, 1),
    buyerTips: cleanList(o.buyerTips, 1),
  };
}

function cleanList(items: unknown, minItems: number): string[] {
  const source = Array.isArray(items) ? items : [];
  const cleaned = source
    .map((item) => String(item).trim())
    .filter((item) => item.length >= 3 && !/^[-–—._]+$/.test(item));
  while (cleaned.length < minItems) cleaned.push(LIST_PLACEHOLDER);
  return cleaned.slice(0, 6);
}

function sanitizeLlmJson(text: string): string {
  return text.replace(/מ"ר/g, "מטר רבוע").replace(/מ"(?=\s*[,}])/g, 'מטר"');
}

function closeDanglingJson(text: string): string {
  let s = text.trim();
  let inString = false;
  let escape = false;
  for (const ch of s) {
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    }
  }
  if (inString) s += '"';
  const openArr = (s.match(/\[/g) ?? []).length;
  const closeArr = (s.match(/]/g) ?? []).length;
  if (openArr > closeArr) s += "]".repeat(openArr - closeArr);
  const openObj = (s.match(/{/g) ?? []).length;
  const closeObj = (s.match(/}/g) ?? []).length;
  if (openObj > closeObj) s += "}".repeat(openObj - closeObj);
  return s;
}

function tryParseObject(text: string): unknown | undefined {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed === "string") {
      return extractJsonObject(parsed);
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    return undefined;
  }
  return undefined;
}
