import type {
  Deal,
  DealValuationMetrics,
  GlobalMetrics,
  NeighborhoodStats,
  StreetStats,
  YearlyTrendPoint,
} from "../../types/domain";
import { cagr, clamp, mean, percentVariance, round2, summarize } from "./math";

export function computeNeighborhoodStats(deals: Deal[]): NeighborhoodStats[] {
  const groups = groupBy(deals, (d) => `${d.city}::${d.neighborhood}`);
  return [...groups.entries()]
    .map(([, group]) => toNeighborhoodStats(group))
    .sort((a, b) => b.dealCount - a.dealCount);
}

export function computeGlobalMetrics(deals: Deal[]): GlobalMetrics {
  const neighborhoods = computeNeighborhoodStats(deals);
  const prices = deals.map((d) => d.priceNis);
  const ppsqm = deals.map((d) => d.pricePerSqm);
  return {
    dealCount: deals.length,
    cities: [...new Set(deals.map((d) => d.city))],
    neighborhoods,
    price: summarize(prices),
    pricePerSqm: summarize(ppsqm),
    historicalCagrPct: computeCagrFromDeals(deals),
  };
}

export function findNeighborhoodStats(
  deals: Deal[],
  neighborhood: string,
): NeighborhoodStats | undefined {
  const needle = neighborhood.trim().toLowerCase();
  return computeNeighborhoodStats(deals).find((n) => n.neighborhood.toLowerCase() === needle);
}

export function evaluateDeal(deal: Deal, corpus: Deal[]): DealValuationMetrics {
  const streetDeals = corpus.filter(
    (d) => d.city === deal.city && d.neighborhood === deal.neighborhood && d.street === deal.street,
  );
  const neighborhoodDeals = corpus.filter(
    (d) => d.city === deal.city && d.neighborhood === deal.neighborhood,
  );
  const streetAvg = streetDeals.length ? mean(streetDeals.map((d) => d.pricePerSqm)) : null;
  const neighborhoodAvg = neighborhoodDeals.length
    ? mean(neighborhoodDeals.map((d) => d.pricePerSqm))
    : null;
  const neighborhoodStd = summarize(neighborhoodDeals.map((d) => d.pricePerSqm)).stddev;
  const varianceVsStreetPct = streetAvg === null ? null : percentVariance(deal.pricePerSqm, streetAvg);
  const varianceVsNeighborhoodPct =
    neighborhoodAvg === null ? null : percentVariance(deal.pricePerSqm, neighborhoodAvg);
  const neighborhoodCagrPct = computeCagrFromDeals(neighborhoodDeals);

  return {
    deal,
    streetAvgPricePerSqm: streetAvg === null ? null : round2(streetAvg),
    neighborhoodAvgPricePerSqm: neighborhoodAvg === null ? null : round2(neighborhoodAvg),
    varianceVsStreetPct,
    varianceVsNeighborhoodPct,
    neighborhoodCagrPct,
    neighborhoodStddevPricePerSqm: neighborhoodStd,
    opportunityScore: scoreOpportunity({
      varianceVsNeighborhoodPct,
      cagrPct: neighborhoodCagrPct,
      stddev: neighborhoodStd,
      meanPpsqm: neighborhoodAvg ?? deal.pricePerSqm,
      sampleSize: neighborhoodDeals.length,
    }),
  };
}

export function toNeighborhoodStats(deals: Deal[]): NeighborhoodStats {
  const first = deals[0];
  const prices = deals.map((d) => d.priceNis);
  const ppsqm = deals.map((d) => d.pricePerSqm);
  const streets = toStreetStats(deals);
  const trend = toYearlyTrend(deals);
  const historicalCagrPct = computeCagrFromDeals(deals);

  return {
    city: first.city,
    neighborhood: first.neighborhood,
    dealCount: deals.length,
    price: summarize(prices),
    pricePerSqm: summarize(ppsqm),
    avgRooms: round2(mean(deals.map((d) => d.rooms))),
    avgSqm: round2(mean(deals.map((d) => d.sqm))),
    historicalCagrPct,
    trend,
    streets,
    dataConfidence: confidence(deals.length, trend.length),
  };
}

export function computeCagrFromDeals(deals: Deal[]): number | null {
  const trend = toYearlyTrend(deals);
  if (trend.length < 2) return null;
  const first = trend[0];
  const last = trend[trend.length - 1];
  return cagr(first.avgPricePerSqm, last.avgPricePerSqm, last.year - first.year);
}

export function toYearlyTrend(deals: Deal[]): YearlyTrendPoint[] {
  const years = groupBy(deals, (d) => String(d.year));
  const points = [...years.entries()]
    .map(([year, group]) => ({
      year: Number(year),
      dealCount: group.length,
      avgPricePerSqm: round2(mean(group.map((d) => d.pricePerSqm))),
      avgPriceNis: round2(mean(group.map((d) => d.priceNis))),
      yoyGrowthPct: null as number | null,
    }))
    .sort((a, b) => a.year - b.year);

  for (let i = 1; i < points.length; i += 1) {
    points[i].yoyGrowthPct = percentVariance(points[i].avgPricePerSqm, points[i - 1].avgPricePerSqm);
  }
  return points;
}

function toStreetStats(deals: Deal[]): StreetStats[] {
  const streets = groupBy(deals, (d) => d.street);
  return [...streets.entries()]
    .map(([street, group]) => ({
      street,
      dealCount: group.length,
      avgPricePerSqm: round2(mean(group.map((d) => d.pricePerSqm))),
      medianPricePerSqm: summarize(group.map((d) => d.pricePerSqm)).median,
      avgPriceNis: round2(mean(group.map((d) => d.priceNis))),
    }))
    .sort((a, b) => b.dealCount - a.dealCount);
}

export function scoreOpportunity(input: {
  varianceVsNeighborhoodPct: number | null;
  cagrPct: number | null;
  stddev: number;
  meanPpsqm: number;
  sampleSize: number;
}): number {
  const discount = input.varianceVsNeighborhoodPct ?? 0;
  const growth = input.cagrPct ?? 0;
  const cv = input.meanPpsqm > 0 ? input.stddev / input.meanPpsqm : 0;

  let score = 50;
  score += clamp(-discount, -25, 25);
  score += clamp(growth * 1.5, -15, 20);
  score -= clamp(cv * 40, 0, 15);
  if (input.sampleSize < 5) score -= 8;
  if (input.sampleSize >= 12) score += 4;

  return round2(clamp(score, 0, 100));
}

function confidence(dealCount: number, yearCount: number): number {
  const volume = clamp(dealCount / 20, 0, 1) * 70;
  const history = clamp(yearCount / 5, 0, 1) * 30;
  return round2(volume + history);
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return map;
}
