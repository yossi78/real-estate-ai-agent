import { env } from "../../config/env";
import { logger } from "../../config/logger";
import type {
  DealValuationMetrics,
  FallbackReason,
  InsightEvaluation,
  LlmInsight,
  NeighborhoodStats,
} from "../../types/domain";
import { getJson, insightKey, setJson } from "../cache/cacheService";
import { fallbackFromDeal, fallbackFromNeighborhood } from "./fallbackEngine";
import { completeJsonChat, LlmTimeoutError } from "./ollamaClient";
import { assertNoRawRows, buildInsightPrompt } from "./promptBuilder";
import { extractJsonObject, parseLlmInsight } from "./schema";
import { Semaphore } from "./semaphore";

const llmGate = new Semaphore(env.ollamaMaxConcurrency);

export interface EvaluateInsightArgs {
  kind: "deal" | "neighborhood";
  subject: InsightEvaluation["subject"];
  stats: Record<string, unknown>;
  calculatedOpportunityScore: number;
  fallbackInsight: LlmInsight;
}

export async function evaluateInsight(args: EvaluateInsightArgs): Promise<InsightEvaluation> {
  assertNoRawRows(args.stats);
  const key = insightKey(args.kind, args.subject);
  const cached = await getJson<InsightEvaluation>(key);
  if (cached?.insightSource === "llm" && !cached.fallbackUsed) {
    return { ...cached, cached: true };
  }

  const prompt = buildInsightPrompt({
    calculatedOpportunityScore: args.calculatedOpportunityScore,
    subjectLabel: describeSubject(args.subject),
    stats: args.stats,
  });

  let insight = args.fallbackInsight;
  let insightSource: InsightEvaluation["insightSource"] = "fallback";
  let fallbackUsed = true;
  let fallbackReason: FallbackReason | undefined;

  try {
    logger.info("llm_request_start", { subject: args.subject, timeoutMs: env.ollamaTimeoutMs });
    const raw = await llmGate.run(() => completeJsonChat(prompt));
    try {
      insight = parseLlmInsight(extractJsonObject(raw));
    } catch (parseError) {
      logger.warn("llm_json_parse_failed", { preview: raw.slice(0, 360) });
      throw parseError;
    }
    insightSource = "llm";
    fallbackUsed = false;
  } catch (error) {
    fallbackReason = classifyFallbackReason(error);
    logger.warn("llm_fallback_engaged", {
      reason: fallbackReason,
      detail: error instanceof Error ? error.message : "unknown",
      subject: args.subject,
    });
    insight = args.fallbackInsight;
    insightSource = "fallback";
    fallbackUsed = true;
  }

  const result: InsightEvaluation = {
    metricsSource: "calculated",
    insightSource,
    fallbackUsed,
    fallbackReason,
    cached: false,
    generatedAt: new Date().toISOString(),
    subject: args.subject,
    stats: args.stats,
    insight,
  };

  if (insightSource === "llm") {
    await setJson(key, result);
  }
  return result;
}

function classifyFallbackReason(error: unknown): FallbackReason {
  if (error instanceof LlmTimeoutError) return "timeout";
  const message = error instanceof Error ? error.message : String(error);
  if (/not found|OLLAMA_HTTP_404/i.test(message)) return "model_missing";
  if (
    message === "NO_JSON_OBJECT" ||
    error instanceof SyntaxError ||
    (error instanceof Error && error.name === "ZodError")
  ) {
    return "invalid_json";
  }
  return "unavailable";
}

export function dealStatsPayload(metrics: DealValuationMetrics): Record<string, unknown> {
  return {
    dealId: metrics.deal.dealId,
    city: metrics.deal.city,
    neighborhood: metrics.deal.neighborhood,
    street: metrics.deal.street,
    rooms: metrics.deal.rooms,
    sqm: metrics.deal.sqm,
    priceNis: metrics.deal.priceNis,
    pricePerSqm: metrics.deal.pricePerSqm,
    streetAvgPricePerSqm: metrics.streetAvgPricePerSqm,
    neighborhoodAvgPricePerSqm: metrics.neighborhoodAvgPricePerSqm,
    varianceVsStreetPct: metrics.varianceVsStreetPct,
    varianceVsNeighborhoodPct: metrics.varianceVsNeighborhoodPct,
    neighborhoodCagrPct: metrics.neighborhoodCagrPct,
    neighborhoodStddevPricePerSqm: metrics.neighborhoodStddevPricePerSqm,
    calculatedOpportunityScore: metrics.opportunityScore,
  };
}

export function neighborhoodStatsPayload(stats: NeighborhoodStats): Record<string, unknown> {
  return {
    city: stats.city,
    neighborhood: stats.neighborhood,
    dealCount: stats.dealCount,
    avgRooms: stats.avgRooms,
    avgSqm: stats.avgSqm,
    price: stats.price,
    pricePerSqm: stats.pricePerSqm,
    historicalCagrPct: stats.historicalCagrPct,
    trend: stats.trend,
    streets: stats.streets.map((s) => ({
      street: s.street,
      dealCount: s.dealCount,
      avgPricePerSqm: s.avgPricePerSqm,
      medianPricePerSqm: s.medianPricePerSqm,
    })),
    dataConfidence: stats.dataConfidence,
    calculatedOpportunityScore: fallbackFromNeighborhood(stats).opportunityScore,
  };
}

export function insightFromDealMetrics(metrics: DealValuationMetrics): Promise<InsightEvaluation> {
  return evaluateInsight({
    kind: "deal",
    subject: {
      dealId: metrics.deal.dealId,
      neighborhood: metrics.deal.neighborhood,
      city: metrics.deal.city,
    },
    stats: dealStatsPayload(metrics),
    calculatedOpportunityScore: metrics.opportunityScore,
    fallbackInsight: fallbackFromDeal(metrics),
  });
}

export function insightFromNeighborhood(stats: NeighborhoodStats): Promise<InsightEvaluation> {
  const payload = neighborhoodStatsPayload(stats);
  return evaluateInsight({
    kind: "neighborhood",
    subject: { neighborhood: stats.neighborhood, city: stats.city },
    stats: payload,
    calculatedOpportunityScore: Number(payload.calculatedOpportunityScore),
    fallbackInsight: fallbackFromNeighborhood(stats),
  });
}

function describeSubject(subject: InsightEvaluation["subject"]): string {
  if (subject.dealId) {
    return `עסקה ${subject.dealId} ב${subject.neighborhood ?? ""}, ${subject.city ?? ""}`;
  }
  return `שכונה ${subject.neighborhood ?? ""} (${subject.city ?? ""})`;
}
