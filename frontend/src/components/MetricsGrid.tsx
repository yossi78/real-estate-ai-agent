import type { GlobalMetrics, NeighborhoodStats } from "../types";
import { SourceBadge } from "./SourceBadge";

function fmt(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("he-IL", { maximumFractionDigits: digits });
}

export function MetricsGrid({
  metrics,
  neighborhood,
}: {
  metrics: GlobalMetrics;
  neighborhood: NeighborhoodStats | null;
}) {
  const cards = [
    { label: "עסקאות במדגם", value: fmt(neighborhood?.dealCount ?? metrics.dealCount) },
    {
      label: "ממוצע ₪/מ״ר",
      value: fmt(neighborhood?.pricePerSqm.mean ?? metrics.pricePerSqm.mean),
    },
    {
      label: "חציון ₪/מ״ר",
      value: fmt(neighborhood?.pricePerSqm.median ?? metrics.pricePerSqm.median),
    },
    {
      label: "סטיית תקן",
      value: fmt(neighborhood?.pricePerSqm.stddev ?? metrics.pricePerSqm.stddev),
    },
    {
      label: "CAGR היסטורי",
      value:
        (neighborhood?.historicalCagrPct ?? metrics.historicalCagrPct) === null
          ? "אין מספיק שנים"
          : `${fmt(neighborhood?.historicalCagrPct ?? metrics.historicalCagrPct, 1)}%`,
    },
    {
      label: "ביטחון בנתונים",
      value: neighborhood ? `${fmt(neighborhood.dataConfidence, 0)}/100` : "—",
    },
  ];

  return (
    <div className="rounded-2xl border border-ink/10 bg-paper p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">מדדים מחושבים</h2>
          <p className="text-sm text-ink/60">
            {neighborhood ? `${neighborhood.neighborhood}, ${neighborhood.city}` : "כל המדגם"}
          </p>
        </div>
        <SourceBadge kind="calculated" extra="Node.js" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <article key={card.label} className="rounded-xl bg-sand px-4 py-3">
            <p className="text-xs text-ink/55">{card.label}</p>
            <p className="num mt-1 text-xl font-extrabold">{card.value}</p>
          </article>
        ))}
      </div>
      {neighborhood && neighborhood.trend.length > 1 && (
        <div className="mt-4 overflow-x-auto">
          <p className="mb-2 text-xs font-semibold text-ink/60">מגמה שנתית (ממוצע ₪/מ״ר)</p>
          <div className="flex gap-2">
            {neighborhood.trend.map((point) => (
              <div key={point.year} className="min-w-24 rounded-lg border border-ink/10 px-3 py-2 text-xs">
                <div className="font-bold">{point.year}</div>
                <div className="num">{fmt(point.avgPricePerSqm)}</div>
                <div className={point.yoyGrowthPct && point.yoyGrowthPct < 0 ? "text-clay" : "text-mossDark"}>
                  {point.yoyGrowthPct === null ? "—" : `${point.yoyGrowthPct > 0 ? "+" : ""}${fmt(point.yoyGrowthPct, 1)}%`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
