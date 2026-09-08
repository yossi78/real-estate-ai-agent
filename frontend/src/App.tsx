import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api/client";
import { CsvUpload } from "./components/CsvUpload";
import { InsightsPanel } from "./components/InsightsPanel";
import { MetricsGrid } from "./components/MetricsGrid";
import { SourceBadge } from "./components/SourceBadge";
import { TransactionsTable } from "./components/TransactionsTable";
import type { Deal, GlobalMetrics, HealthResponse, InsightEvaluation } from "./types";

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [metrics, setMetrics] = useState<GlobalMetrics | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [totalDeals, setTotalDeals] = useState(0);
  const [neighborhood, setNeighborhood] = useState("");
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<InsightEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [insightLoading, setInsightLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (selected?: string) => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, metricsRes, dealsRes] = await Promise.all([
        api.health(),
        api.metrics(),
        api.deals({ neighborhood: selected || undefined, limit: 50 }),
      ]);
      setHealth(healthRes);
      setMetrics(metricsRes.metrics);
      setDeals(dealsRes.items);
      setTotalDeals(dealsRes.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינת הנתונים");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(neighborhood);
  }, [load, neighborhood]);

  const evaluate = useCallback(async (payload: { dealId?: string; neighborhood?: string }) => {
    setInsightLoading(true);
    setError(null);
    try {
      const result = await api.evaluate(payload);
      setEvaluation(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בהפקת תובנה");
    } finally {
      setInsightLoading(false);
    }
  }, []);

  const neighborhoods = useMemo(
    () => metrics?.neighborhoods.map((n) => n.neighborhood) ?? [],
    [metrics],
  );

  const selectedNeighborhoodStats = useMemo(() => {
    if (!metrics) return null;
    if (neighborhood) {
      return metrics.neighborhoods.find((n) => n.neighborhood === neighborhood) ?? null;
    }
    return metrics.neighborhoods[0] ?? null;
  }, [metrics, neighborhood]);

  return (
    <div className="min-h-screen" dir="rtl">
      <header className="border-b border-ink/10 bg-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-moss">MADLAN DEAL DESK</p>
            <h1 className="mt-1 text-2xl font-extrabold text-ink md:text-3xl">הערכת עסקאות והזדמנויות</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink/70">
              המספרים מחושבים ב-Node.js. המודל המקומי רק מפרש. אם Ollama נכשל — מוצג גיבוי דטרמיניסטי.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <StatusPill ok={Boolean(health?.redis)} label="Redis" />
            <StatusPill ok={Boolean(health?.ollama)} label={health?.model ?? "Ollama"} />
            <SourceBadge kind="calculated" />
            <SourceBadge kind="ai" />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-5">
          <div className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-paper p-4 shadow-card md:flex-row md:items-end md:justify-between">
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink/80">סינון שכונה</span>
              <select
                className="w-full min-w-56 rounded-xl border border-ink/15 bg-sand px-3 py-2 text-sm outline-none ring-moss focus:ring-2"
                value={neighborhood}
                onChange={(e) => {
                  setNeighborhood(e.target.value);
                  setSelectedDealId(null);
                }}
              >
                <option value="">כל השכונות</option>
                {neighborhoods.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <a
                href="/docs/presentation.html"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-ink/15 bg-sand px-4 py-2 text-sm font-semibold hover:bg-white"
              >
                מצגת הסבר
              </a>
              <button
                type="button"
                className="rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-mossDark"
                onClick={() =>
                  void evaluate(
                    neighborhood
                      ? { neighborhood }
                      : selectedNeighborhoodStats
                        ? { neighborhood: selectedNeighborhoodStats.neighborhood }
                        : {},
                  )
                }
                disabled={insightLoading || !selectedNeighborhoodStats}
              >
                {insightLoading ? "מנתח..." : "תובנת AI לשכונה"}
              </button>
              <CsvUpload
                onUploaded={() => {
                  setEvaluation(null);
                  void load(neighborhood);
                }}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay">{error}</div>
          )}

          {loading || !metrics ? (
            <div className="rounded-2xl border border-ink/10 bg-paper p-8 text-ink/60">טוען מדדים מחושבים...</div>
          ) : (
            <MetricsGrid metrics={metrics} neighborhood={selectedNeighborhoodStats} />
          )}

          <TransactionsTable
            deals={deals}
            total={totalDeals}
            selectedDealId={selectedDealId}
            onSelect={(deal) => {
              setSelectedDealId(deal.dealId);
              void evaluate({ dealId: deal.dealId });
            }}
          />
        </section>

        <InsightsPanel evaluation={evaluation} loading={insightLoading} />
      </main>
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 font-medium ${ok ? "bg-moss/15 text-mossDark" : "bg-ink/10 text-ink/50"}`}
    >
      {ok ? "●" : "○"} {label}
    </span>
  );
}
