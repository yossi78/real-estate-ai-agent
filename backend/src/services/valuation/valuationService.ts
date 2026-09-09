import { NotFoundError, ValidationError } from "../../middleware/errorHandler";
import type { Deal, GlobalMetrics, InsightEvaluation, NeighborhoodStats } from "../../types/domain";
import { bustStatsCache, getJson, globalStatsKey, neighborhoodStatsKey, setJson } from "../cache/cacheService";
import { insightFromDealMetrics, insightFromNeighborhood } from "../llm/insightService";
import { computeGlobalMetrics, evaluateDeal, findNeighborhoodStats } from "../stats/calculationEngine";
import { findDealById, getDeals, hydrateCorpusFromRedis, loadDealsFromCsv, persistCorpus } from "../../store/dealStore";

async function persistNeighborhoodRollups(neighborhoods: NeighborhoodStats[]): Promise<void> {
  await Promise.all(
    neighborhoods.map((n) => setJson(neighborhoodStatsKey(n.city, n.neighborhood), n)),
  );
}

export async function getCachedGlobalMetrics(): Promise<GlobalMetrics> {
  await hydrateCorpusFromRedis();
  const cached = await getJson<GlobalMetrics>(globalStatsKey());
  if (cached) {
    await persistNeighborhoodRollups(cached.neighborhoods);
    return cached;
  }
  const computed = computeGlobalMetrics(getDeals());
  await setJson(globalStatsKey(), computed);
  await persistNeighborhoodRollups(computed.neighborhoods);
  return computed;
}

export async function getCachedNeighborhood(name: string): Promise<NeighborhoodStats> {
  await hydrateCorpusFromRedis();
  const deals = getDeals();
  const stats = findNeighborhoodStats(deals, name);
  if (!stats) {
    throw new NotFoundError(`שכונה לא נמצאה: ${name}`);
  }
  const key = neighborhoodStatsKey(stats.city, stats.neighborhood);
  const cached = await getJson<NeighborhoodStats>(key);
  if (cached) return cached;
  await setJson(key, stats);
  return stats;
}

export async function listDeals(filters: {
  neighborhood?: string;
  street?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: Deal[]; total: number; page: number; limit: number }> {
  await hydrateCorpusFromRedis();
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  let items = getDeals();
  if (filters.neighborhood) {
    const n = filters.neighborhood.trim().toLowerCase();
    items = items.filter((d) => d.neighborhood.toLowerCase() === n);
  }
  if (filters.street) {
    const s = filters.street.trim().toLowerCase();
    items = items.filter((d) => d.street.toLowerCase() === s);
  }
  const total = items.length;
  const start = (page - 1) * limit;
  return { items: items.slice(start, start + limit), total, page, limit };
}

export async function ingestCsv(buffer: Buffer): Promise<{ count: number; dropped: number }> {
  const result = loadDealsFromCsv(buffer);
  if (result.deals.length === 0) {
    throw new ValidationError("לא נותרו עסקאות תקינות אחרי ניקוי ה-CSV");
  }
  await persistCorpus();
  await bustStatsCache();
  return { count: result.deals.length, dropped: result.dropped };
}

export async function evaluateSubject(input: {
  dealId?: string;
  neighborhood?: string;
}): Promise<InsightEvaluation> {
  if (!input.dealId && !input.neighborhood) {
    throw new ValidationError("יש לספק dealId או neighborhood");
  }

  await hydrateCorpusFromRedis();

  if (input.dealId) {
    const deal = findDealById(input.dealId);
    if (!deal) throw new NotFoundError(`עסקה לא נמצאה: ${input.dealId}`);
    const metrics = evaluateDeal(deal, getDeals());
    const hood = findNeighborhoodStats(getDeals(), deal.neighborhood);
    if (hood) {
      await setJson(neighborhoodStatsKey(hood.city, hood.neighborhood), hood);
    }
    return insightFromDealMetrics(metrics);
  }

  const stats = await getCachedNeighborhood(input.neighborhood as string);
  return insightFromNeighborhood(stats);
}
