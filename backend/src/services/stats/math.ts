import type { NumericSummary } from "../../types/domain";

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/** Sample standard deviation (n-1). Returns 0 when n < 2. */
export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function minMax(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 0 };
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export function summarize(values: number[]): NumericSummary {
  const { min, max } = minMax(values);
  return {
    count: values.length,
    mean: round2(mean(values)),
    median: round2(median(values)),
    stddev: round2(stddev(values)),
    min: round2(min),
    max: round2(max),
  };
}

export function percentVariance(value: number, baseline: number): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline === 0) {
    return null;
  }
  return round2(((value - baseline) / baseline) * 100);
}

export function cagr(startValue: number, endValue: number, years: number): number | null {
  if (years <= 0 || startValue <= 0 || endValue <= 0) return null;
  return round2((Math.pow(endValue / startValue, 1 / years) - 1) * 100);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function slug(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}
