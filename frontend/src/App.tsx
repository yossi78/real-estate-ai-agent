import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api/client";
import { ClearCacheButton } from "./components/ClearCacheButton";
import { CsvUpload } from "./components/CsvUpload";
import { InsightsPanel } from "./components/InsightsPanel";
import { LoadingSpinner } from "./components/LoadingSpinner";
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
  const [evaluatingDealId, setEvaluatingDealId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const evaluateSeq = useRef(0);

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
    const seq = ++evaluateSeq.current;
    setInsightLoading(true);
    setEvaluatingDealId(payload.dealId ?? null);
    setError(null);
    try {
      const result = await api.evaluate(payload);
      if (seq !== evaluateSeq.current) return;
      setEvaluation(result);
    } catch (err) {
      if (seq !== evaluateSeq.current) return;
      setError(err instanceof Error ? err.message : "שגיאה בהפקת תובנה");
    } finally {
      if (seq === evaluateSeq.current) {
        setInsightLoading(false);
        setEvaluatingDealId(null);
      }
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
    <div className="min-h-screen text-slate-100" dir="rtl">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[90rem] flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 shadow-glow">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                <path d="M4 20V10l8-6 8 6v10" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M9 20v-6h6v6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.22em] text-emerald-400">MADLAN DEAL DESK</p>
              <h1 className="mt-0.5 text-xl font-extrabold tracking-tight text-white md:text-2xl">
                הערכת עסקאות והזדמנויות
              </h1>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400 md:text-sm">
                המספרים מחושבים ב-Node.js. המודל המקומי רק מפרש. אם Ollama נכשל — מוצג גיבוי דטרמיניסטי.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <StatusPill ok={Boolean(health?.ollama)} label={health?.model || "Llama3"} />
            <StatusPill ok={Boolean(health?.redis)} label="Redis" />
            <StatusPill ok={Boolean(health?.ollama)} label="Ollama" />
            <SourceBadge kind="calculated" />
            <SourceBadge kind="ai" />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[90rem] gap-5 px-5 py-6 lg:grid-cols-[16.5rem_minmax(0,1fr)_24rem]">
        <div className="order-2 lg:order-none">
          {loading || !metrics ? (
            <div className="card flex items-center gap-3 p-5 text-sm text-slate-400">
              <LoadingSpinner size="sm" label="טוען מדדים" className="text-emerald-400" />
              טוען מדדים מחושבים...
            </div>
          ) : (
            <MetricsGrid metrics={metrics} neighborhood={selectedNeighborhoodStats} />
          )}
        </div>

        <section className="order-1 space-y-5 lg:order-none">
          <div className="card flex flex-col gap-3 p-4 md:flex-row md:items-end md:justify-between">
            <label className="block text-sm">
              <span className="mb-1 block text-[11px] font-semibold tracking-wide text-slate-400">סינון שכונה</span>
              <select
                className="field-select"
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
              {neighborhood && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setNeighborhood("");
                    setSelectedDealId(null);
                  }}
                >
                  נקה סינון
                </button>
              )}
              <a
                href="/docs/presentation.html"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                מצגת הסבר
              </a>
              <button
                type="button"
                className="btn-primary"
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
                {insightLoading && <LoadingSpinner size="sm" label="מנתח שכונה" className="text-slate-950" />}
                {insightLoading ? "מנתח..." : "תובנת AI לשכונה"}
              </button>
              <ClearCacheButton
                disabled={!health?.redis}
                onCleared={() => setEvaluation(null)}
              />
              <CsvUpload
                onUploaded={() => {
                  setEvaluation(null);
                  void load(neighborhood);
                }}
              />
            </div>
          </div>

          {error && (
            <div className="max-h-32 overflow-auto rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-300 break-words">
              {error}
            </div>
          )}

          <TransactionsTable
            deals={deals}
            total={totalDeals}
            selectedDealId={selectedDealId}
            loadingDealId={evaluatingDealId}
            onSelect={(deal) => {
              setSelectedDealId(deal.dealId);
              void evaluate({ dealId: deal.dealId });
            }}
          />
        </section>

        <div className="order-3 lg:order-none">
          <InsightsPanel evaluation={evaluation} loading={insightLoading} />
        </div>
      </main>
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
        ok
          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
          : "border-white/10 bg-slate-800 text-slate-400"
      }`}
    >
      <span className="relative flex h-2 w-2">
        {ok && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-slate-400"}`}
        />
      </span>
      {label}
    </span>
  );
}
