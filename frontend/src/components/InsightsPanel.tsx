import type { FallbackReason, InsightEvaluation } from "../types";
import { SourceBadge } from "./SourceBadge";

const fallbackCopy: Record<FallbackReason, string> = {
  model_missing: "המודל לא מותקן ב-Ollama. הוצג ניתוח דטרמיניסטי מהנתונים.",
  timeout: "Ollama לא סיים בזמן. הוצג ניתוח דטרמיניסטי מהנתונים.",
  invalid_json: "Ollama לא החזיר JSON תקין. הוצג ניתוח דטרמיניסטי מהנתונים.",
  unavailable: "Ollama לא היה זמין. הוצג ניתוח דטרמיניסטי מהנתונים.",
};

const verdictLabel = {
  buy: "כדאי לבחון רכישה",
  hold: "תמחור סביר / המתנה",
  avoid: "פרמיה גבוהה — זהירות",
};

export function InsightsPanel({
  evaluation,
  loading,
}: {
  evaluation: InsightEvaluation | null;
  loading: boolean;
}) {
  return (
    <aside className="h-fit rounded-2xl border border-ink/10 bg-paper p-5 shadow-card lg:sticky lg:top-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">תובנת נכס / שכונה</h2>
        {evaluation ? (
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

      {loading && <p className="text-sm text-ink/60">מריץ פרשנות... timeout מוגבל ל-120 שניות.</p>}

      {!loading && !evaluation && (
        <p className="text-sm leading-6 text-ink/70">
          בחרו עסקה מהטבלה או לחצו «תובנת AI לשכונה». הנתונים הגולמיים לא נשלחים למודל — רק JSON סטטיסטי.
        </p>
      )}

      {evaluation && (
        <div className="space-y-4">
          <div className="rounded-xl bg-sand p-4">
            <p className="text-xs text-ink/55">ציון הזדמנות</p>
            <p className="mt-1 text-3xl font-extrabold text-mossDark">{Math.round(evaluation.insight.opportunityScore)}</p>
            <p className="mt-1 text-sm font-semibold">{verdictLabel[evaluation.insight.verdict]}</p>
          </div>
          <p className="text-sm leading-7">{evaluation.insight.summary}</p>
          <List title="יתרונות" items={evaluation.insight.pros} />
          <List title="חסרונות" items={evaluation.insight.cons} />
          <List title="סיכונים" items={evaluation.insight.risks} />
          <List title="טיפים לרוכש" items={evaluation.insight.buyerTips} />
          <div>
            <h3 className="mb-1 text-sm font-bold">נרטיב שוק</h3>
            <p className="text-sm leading-7 text-ink/80">{evaluation.insight.marketNarrative}</p>
          </div>
          {evaluation.fallbackUsed && (
            <p className="rounded-lg bg-clay/10 px-3 py-2 text-xs text-clay">
              {fallbackCopy[evaluation.fallbackReason ?? "unavailable"]}
            </p>
          )}
        </div>
      )}
    </aside>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-bold">{title}</h3>
      <ul className="list-disc pr-5 text-sm leading-7 text-ink/80">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
