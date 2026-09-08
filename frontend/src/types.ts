export interface NumericSummary {
  count: number;
  mean: number;
  median: number;
  stddev: number;
  min: number;
  max: number;
}

export interface YearlyTrendPoint {
  year: number;
  dealCount: number;
  avgPricePerSqm: number;
  avgPriceNis: number;
  yoyGrowthPct: number | null;
}

export interface StreetStats {
  street: string;
  dealCount: number;
  avgPricePerSqm: number;
  medianPricePerSqm: number;
  avgPriceNis: number;
}

export interface NeighborhoodStats {
  city: string;
  neighborhood: string;
  dealCount: number;
  price: NumericSummary;
  pricePerSqm: NumericSummary;
  avgRooms: number;
  avgSqm: number;
  historicalCagrPct: number | null;
  trend: YearlyTrendPoint[];
  streets: StreetStats[];
  dataConfidence: number;
}

export interface Deal {
  dealId: string;
  date: string;
  year: number;
  city: string;
  neighborhood: string;
  street: string;
  rooms: number;
  floor: number | null;
  sqm: number;
  priceNis: number;
  pricePerSqm: number;
  propertyType: string;
  yearBuilt: number | null;
}

export interface GlobalMetrics {
  dealCount: number;
  cities: string[];
  neighborhoods: NeighborhoodStats[];
  price: NumericSummary;
  pricePerSqm: NumericSummary;
  historicalCagrPct: number | null;
}

export interface LlmInsight {
  summary: string;
  opportunityScore: number;
  verdict: "buy" | "hold" | "avoid";
  pros: string[];
  cons: string[];
  risks: string[];
  buyerTips: string[];
  marketNarrative: string;
}

export type FallbackReason = "timeout" | "model_missing" | "invalid_json" | "unavailable";

export interface InsightEvaluation {
  metricsSource: "calculated";
  insightSource: "llm" | "fallback";
  fallbackUsed: boolean;
  fallbackReason?: FallbackReason;
  cached: boolean;
  generatedAt: string;
  subject: { dealId?: string; neighborhood?: string; city?: string };
  stats: Record<string, unknown>;
  insight: LlmInsight;
}

export interface DealsResponse {
  items: Deal[];
  total: number;
  page: number;
  limit: number;
}

export interface HealthResponse {
  status: string;
  redis: boolean;
  ollama: boolean;
  model: string;
  dealsLoaded: number;
}
