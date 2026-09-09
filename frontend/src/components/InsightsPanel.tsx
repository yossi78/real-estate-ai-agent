import type { FallbackReason, InsightEvaluation } from "../types";
import { LoadingSpinner } from "./LoadingSpinner";
import { SourceBadge } from "./SourceBadge";

const fallbackCopy: Record<FallbackReason, string> = {
  model_missing: "המודל לא מותקן ב-Ollama. הוצג ניתוח דטרמיניסטי מהנתונים.",
  timeout: "Ollama לא סיים בזמן. הוצג ניתוח דטרמיניסטי מהנתונים.",
  invalid_json: "Ollama לא החזיר JSON תקין. הוצג ניתוח דטרמיניסטי מהנתונים.",
  unavailable: "Ollama לא היה זמין. הוצג ניתוח דטרמיניסטי מהנתונים.",
};

const verdictMeta = {
  buy: { label: "כדאי לבחון רכישה", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  hold: { label: "תמחור סביר / המתנה", className: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  avoid: { label: "פרמיה גבוהה — זהירות", className: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
};

const ringColor = {
  buy: "#34d399",
  hold: "#fbbf24",
  avoid: "#fb7185",
};

function numericStat(stats: Record<string, unknown>, key: string): number | null {
  const value = stats[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function ScoreRing({
  score,
  baseline,
  verdict,
}: {
  score: number;
  baseline: number | null;
  verdict: keyof typeof ringColor;
}) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;
  const color = ringColor[verdict];

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[5.5rem] w-[5.5rem] shrink-0">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 88 88" aria-hidden="true">
          <circle cx="44" cy="44" r={radius} fill="none" stroke="#1e293b" strokeWidth="8" />
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="num text-xl font-extrabold leading-none text-white">{Math.round(score)}</span>
          <span className="text-[10px] font-semibold text-slate-500">/100</span>
        </div>
      </div>
      <div>
        <p className="text-[11px] font-medium text-slate-400">ציון הזדמנות</p>
        <p className="mt-0.5 text-3xl font-extrabold tracking-tight text-white">
          <span className="num">{Math.round(score)}</span>
          <span className="text-lg font-semibold text-slate-500"> / 100</span>
        </p>
        {baseline !== null && (
          <p className="mt-0.5 text-[10px] text-slate-500">
            ציון מחושב: <span className="num">{Math.round(baseline)}</span>/100
          </p>
        )}
        <span className={`mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${verdictMeta[verdict].className}`}>
          {verdictMeta[verdict].label}
        </span>
      </div>
    </div>
  );
}

export function InsightsPanel({
  evaluation,
  loading,
}: {
  evaluation: InsightEvaluation | null;
  loading: boolean;
}) {
  const calculatedScore = evaluation ? numericStat(evaluation.stats, "calculatedOpportunityScore") : null;

  return (
    <aside className="card h-fit p-5 lg:sticky lg:top-20">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold tracking-tight text-white">תובנת נכס / שכונה</h2>
          <p className="text-[11px] text-slate-400">ניתוח מקומי · הנתונים הגולמיים לא נשלחים</p>
        </div>
        {loading ? (
          <SourceBadge kind="ai" extra="מנתח" />
        ) : evaluation ? (
          <SourceBadge
            kind={evaluation.insightSource === "llm" ? "ai" : "calculated"}
            extra={
              evaluation.insightSource === "llm"
                ? evaluation.cached
                  ? "מטמון Redis"
                  : "Ollama"
                : "מנוע גיבוי"
            }
          />
        ) : (
          <SourceBadge kind="ai" extra="ממתין" />
        )}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center gap-5 py-12 text-center">
          <LoadingSpinner size="xl" timed label="המודל מנתח את העסקה" className="text-emerald-400" />
          <div>
            <p className="text-base font-semibold text-white">המודל המקומי מנתח...</p>
            <p className="mt-1 max-w-xs text-sm leading-6 text-slate-400">
              זה יכול לקחת עד כשתי דקות. התוצאה תופיע כאן כשהניתוח יסתיים.
            </p>
          </div>
        </div>
      )}

      {!loading && !evaluation && (
        <div className="rounded-xl border border-dashed border-white/15 bg-slate-950/50 px-4 py-6 text-sm leading-6 text-slate-400">
          בחרו עסקה מהטבלה או לחצו «תובנת AI לשכונה». הנתונים הגולמיים לא נשלחים למודל — רק JSON סטטיסטי.
        </div>
      )}

      {!loading && evaluation && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <ScoreRing
              score={evaluation.insight.opportunityScore}
              baseline={calculatedScore}
              verdict={evaluation.insight.verdict}
            />
          </div>
          <p className="text-sm leading-7 text-slate-300">{evaluation.insight.summary}</p>
          <List title="יתרונות" items={evaluation.insight.pros} tone="pro" />
          <List title="חסרונות" items={evaluation.insight.cons} tone="con" />
          <List title="סיכונים" items={evaluation.insight.risks} tone="risk" />
          <List title="טיפים לרוכש" items={evaluation.insight.buyerTips} tone="tip" />
          <div className="rounded-xl bg-slate-950/60 px-3 py-3">
            <h3 className="mb-1 text-sm font-bold text-slate-100">נרטיב שוק</h3>
            <p className="text-sm leading-7 text-slate-400">{evaluation.insight.marketNarrative}</p>
          </div>
          {evaluation.fallbackUsed && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              {fallbackCopy[evaluation.fallbackReason ?? "unavailable"]}
            </p>
          )}
        </div>
      )}
    </aside>
  );
}

const listTone = {
  pro: {
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    bullet: "bg-emerald-400",
  },
  con: {
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    bullet: "bg-amber-400",
  },
  risk: {
    badge: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    bullet: "bg-rose-400",
  },
  tip: {
    badge: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    bullet: "bg-sky-400",
  },
};

function List({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: keyof typeof listTone;
}) {
  const meta = listTone[tone];
  return (
    <div>
      <h3 className="mb-2">
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${meta.badge}`}>
          {title}
        </span>
      </h3>
      <ul className="space-y-1.5 text-sm leading-6 text-slate-300">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${meta.bullet}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
