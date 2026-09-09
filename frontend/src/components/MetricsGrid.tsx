import type { GlobalMetrics, NeighborhoodStats } from "../types";
import { SourceBadge } from "./SourceBadge";

function fmt(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("he-IL", { maximumFractionDigits: digits });
}

function TrendBadge({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-[11px] text-slate-500">—</span>;
  }
  const down = value < 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
        down ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300"
      }`}
    >
      <span aria-hidden="true">{down ? "▼" : "▲"}</span>
      {`${value > 0 ? "+" : ""}${fmt(value, 1)}%`}
    </span>
  );
}

export function MetricsGrid({
  metrics,
  neighborhood,
}: {
  metrics: GlobalMetrics;
  neighborhood: NeighborhoodStats | null;
}) {
  const cagr = neighborhood?.historicalCagrPct ?? metrics.historicalCagrPct;
  const rows = [
    {
      label: "עסקאות במדגם",
      value: fmt(neighborhood?.dealCount ?? metrics.dealCount),
    },
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
      value: cagr === null ? "אין מספיק שנים" : `${fmt(cagr, 1)}%`,
      trend: cagr,
    },
    {
      label: "ביטחון בנתונים",
      value: neighborhood ? `${fmt(neighborhood.dataConfidence, 0)}/100` : "—",
    },
  ];

  return (
    <aside className="card h-fit p-4 lg:sticky lg:top-20">
      <div className="mb-3">
        <h2 className="text-base font-bold tracking-tight text-white">מדדים מחושבים</h2>
        <p className="mt-0.5 text-[11px] leading-4 text-slate-400">
          {neighborhood ? `${neighborhood.neighborhood}, ${neighborhood.city}` : "כל המדגם"}
        </p>
        <div className="mt-2">
          <SourceBadge kind="calculated" extra="Node.js" />
        </div>
      </div>
      <dl className="divide-y divide-white/10">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 py-2.5">
            <dt className="text-[11px] text-slate-400">{row.label}</dt>
            <dd className="flex items-center gap-2">
              {"trend" in row && row.trend != null ? <TrendBadge value={row.trend} /> : null}
              <span className="num text-sm font-extrabold text-white">{row.value}</span>
            </dd>
          </div>
        ))}
      </dl>
      {neighborhood && neighborhood.trend.length > 1 && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="mb-2 text-[11px] font-semibold text-slate-400">מגמה שנתית</p>
          <div className="space-y-1.5">
            {neighborhood.trend.map((point) => (
              <div key={point.year} className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="font-bold text-slate-300">{point.year}</span>
                <span className="num text-slate-200">{fmt(point.avgPricePerSqm)}</span>
                <TrendBadge value={point.yoyGrowthPct} />
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
