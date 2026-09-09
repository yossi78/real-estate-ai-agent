import type { Deal } from "../types";
import { LoadingSpinner } from "./LoadingSpinner";
import { SourceBadge } from "./SourceBadge";

function money(n: number): string {
  return n.toLocaleString("he-IL", { maximumFractionDigits: 0 });
}

function exportDealsCsv(deals: Deal[]): void {
  const headers = ["מזהה", "תאריך", "שכונה", "רחוב", "חדרים", "מ״ר", "מחיר", "₪/מ״ר"];
  const rows = deals.map((deal) =>
    [
      deal.dealId,
      deal.date,
      deal.neighborhood,
      deal.street,
      deal.rooms,
      deal.sqm,
      deal.priceNis,
      deal.pricePerSqm,
    ].join(","),
  );
  const csv = `\uFEFF${[headers.join(","), ...rows].join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "madlan-deals.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function TransactionsTable({
  deals,
  total,
  selectedDealId,
  loadingDealId,
  onSelect,
}: {
  deals: Deal[];
  total: number;
  selectedDealId: string | null;
  loadingDealId?: string | null;
  onSelect: (deal: Deal) => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-tight text-white">עסקאות</h2>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
              {total}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            רשומות אחרי ניקוי · בחירה שולחת סיכום סטטיסטי ל-LLM
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SourceBadge kind="calculated" />
          <button
            type="button"
            className="btn-secondary !px-3 !py-1.5 text-xs"
            disabled={deals.length === 0}
            onClick={() => exportDealsCsv(deals)}
          >
            ייצוא
          </button>
        </div>
      </div>
      <div className="max-h-[640px] overflow-auto">
        <table className="w-full min-w-[720px] text-right text-sm">
          <thead className="sticky top-0 z-10 bg-slate-950/90 text-[11px] uppercase tracking-wide text-slate-400 backdrop-blur">
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 font-semibold">מזהה</th>
              <th className="px-4 py-3 font-semibold">תאריך</th>
              <th className="px-4 py-3 font-semibold">שכונה / רחוב</th>
              <th className="px-4 py-3 font-semibold">חדרים</th>
              <th className="px-4 py-3 text-left font-semibold">מ״ר</th>
              <th className="px-4 py-3 text-left font-semibold">מחיר</th>
              <th className="px-4 py-3 text-left font-semibold">₪/מ״ר</th>
            </tr>
          </thead>
          <tbody>
            {deals.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                  אין עסקאות להצגה בסינון הנוכחי
                </td>
              </tr>
            )}
            {deals.map((deal, index) => {
              const active = deal.dealId === selectedDealId;
              const rowLoading = deal.dealId === loadingDealId;
              return (
                <tr
                  key={deal.dealId}
                  aria-busy={rowLoading}
                  className={`cursor-pointer border-b border-white/5 transition-colors ${
                    active
                      ? "bg-emerald-500/10 shadow-[inset_-3px_0_0_#34d399]"
                      : index % 2 === 0
                        ? "bg-transparent hover:bg-white/5"
                        : "bg-white/[0.03] hover:bg-white/5"
                  }`}
                  onClick={() => onSelect(deal)}
                >
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-2">
                      {rowLoading && <LoadingSpinner size="sm" label="מנתח עסקה" />}
                      <span className="rounded-md border border-white/10 bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-slate-200">
                        {deal.dealId}
                      </span>
                    </span>
                  </td>
                  <td className="num px-4 py-2.5 text-slate-400">{deal.date}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-slate-100">{deal.neighborhood}</span>
                    <span className="block text-xs text-slate-500">{deal.street}</span>
                  </td>
                  <td className="num px-4 py-2.5 text-slate-400">{deal.rooms}</td>
                  <td className="num px-4 py-2.5 text-left text-slate-400">{deal.sqm}</td>
                  <td className="num px-4 py-2.5 text-left font-medium text-slate-200">{money(deal.priceNis)}</td>
                  <td className="num px-4 py-2.5 text-left font-bold text-white">{money(deal.pricePerSqm)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
