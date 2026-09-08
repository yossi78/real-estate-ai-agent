import {
  cagr,
  clamp,
  mean,
  median,
  minMax,
  percentVariance,
  round2,
  slug,
  stddev,
  summarize,
} from "../../src/services/stats/math";

describe("math helpers", () => {
  it("rounds to two decimal places", () => {
    expect(round2(10.126)).toBe(10.13);
    expect(round2(10.124)).toBe(10.12);
  });

  it("computes mean, including empty arrays", () => {
    expect(mean([10, 20, 30])).toBe(20);
    expect(mean([])).toBe(0);
  });

  it("computes median for odd, even, and empty lists", () => {
    expect(median([1, 3, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBe(0);
  });

  it("computes sample stddev and returns 0 when n < 2", () => {
    expect(stddev([2, 4])).toBeCloseTo(Math.sqrt(2));
    expect(stddev([5])).toBe(0);
    expect(stddev([])).toBe(0);
  });

  it("computes min/max and a numeric summary", () => {
    expect(minMax([])).toEqual({ min: 0, max: 0 });
    expect(minMax([8, 2, 5])).toEqual({ min: 2, max: 8 });
    expect(summarize([1, 2, 3])).toEqual({
      count: 3,
      mean: 2,
      median: 2,
      stddev: 1,
      min: 1,
      max: 3,
    });
  });

  it("computes percent variance and rejects invalid baselines", () => {
    expect(percentVariance(110, 100)).toBe(10);
    expect(percentVariance(90, 100)).toBe(-10);
    expect(percentVariance(10, 0)).toBeNull();
    expect(percentVariance(Number.NaN, 100)).toBeNull();
    expect(percentVariance(10, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("computes CAGR and rejects non-positive inputs", () => {
    expect(cagr(10_000, 12_100, 2)).toBe(10);
    expect(cagr(10_000, 12_100, 0)).toBeNull();
    expect(cagr(0, 12_100, 2)).toBeNull();
    expect(cagr(10_000, 0, 2)).toBeNull();
    expect(cagr(10_000, 12_100, -1)).toBeNull();
  });

  it("clamps values and slugs strings", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-2, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
    expect(slug("  Ramat  Aviv ")).toBe("ramat-aviv");
  });
});
