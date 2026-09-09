import { env } from "../../config/env";
import type { LlmPromptPayload } from "../../types/domain";
import { LLM_JSON_SCHEMA_DESCRIPTION } from "./schema";

export const LLM_TEMPERATURE = 0.1;

export interface InsightPromptInput {
  calculatedOpportunityScore: number;
  subjectLabel: string;
  stats: Record<string, unknown>;
}

export function buildInsightPrompt(input: InsightPromptInput): LlmPromptPayload {
  const temperature = env.ollamaTemperature || LLM_TEMPERATURE;
  const system = [
    "אתה אנליסט נדל״ן ישראלי. מותר להסתמך רק על המספרים שב-JSON.",
    "אסור להמציא מחירים או אחוזים. אם חסר מידע — ציין זאת.",
    "החזר אובייקט JSON בלבד. הטקסט בעברית. כתוב מטר רבוע ולא מ״ר.",
    "כל פריט ב-pros/cons/risks/buyerTips הוא משפט עברי מלא — אסור מקף בודד.",
    `סכימה: ${LLM_JSON_SCHEMA_DESCRIPTION}`,
    "opportunityScore בסטייה של עד 8 מ-calculatedOpportunityScore.",
    "verdict: buy אם זול מהותית מהשכונה; avoid אם יקר או תנודתי מאוד; אחרת hold.",
  ].join(" ");

  const user = JSON.stringify({
    instruction: "פרש את הסטטיסטיקה: סיכום, יתרונות, חסרונות, סיכונים וטיפים לרוכש.",
    subject: input.subjectLabel,
    calculatedOpportunityScore: input.calculatedOpportunityScore,
    stats: input.stats,
  });

  return {
    system,
    user,
    temperature,
    format: "json",
  };
}

export function assertNoRawRows(stats: Record<string, unknown>): void {
  const banned = ["rows", "deals", "raw", "transactions", "csv"];
  for (const key of Object.keys(stats)) {
    if (banned.includes(key.toLowerCase())) {
      throw new Error(`PROMPT_CONTAINS_RAW_ROWS:${key}`);
    }
  }
}
