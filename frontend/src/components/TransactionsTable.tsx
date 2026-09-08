import type { Deal } from "../types";
import { SourceBadge } from "./SourceBadge";

function money(n: number): string {
  return n.toLocaleString("he-IL", { maximumFractionDigits: 0 });
}

export function TransactionsTable({
  deals,
  total,
  selectedDealId,
  onSelect,
}: {
  deals: Deal[];
  total: number;
  selectedDealId: string | null;
  onSelect: (deal: Deal) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink/10 bg-paper shadow-card">
      <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
        <div>
          <h2 className="text-lg font-bold">עסקאות</h2>
          <p className="text-sm text-ink/60">
            {total} רשומות אחרי ניקוי · בחירה שולחת סיכום סטטיסטי ל-LLM
          </p>
        </div>
        <SourceBadge kind="calculated" />
      </div>
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full min-w-[720px] text-right text-sm">
          <thead className="sticky top-0 bg-sand text-xs text-ink/60">
            <tr>
              <th className="px-4 py-2 font-semibold">מזהה</th>
              <th className="px-4 py-2 font-semibold">תאריך</th>
              <th className="px-4 py-2 font-semibold">שכונה / רחוב</th>
              <th className="px-4 py-2 font-semibold">חדרים</th>
              <th className="px-4 py-2 font-semibold">מ״ר</th>
              <th className="px-4 py-2 font-semibold">מחיר</th>
              <th className="px-4 py-2 font-semibold">₪/מ״ר</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((deal) => {
              const active = deal.dealId === selectedDealId;
              return (
                <tr
                  key={deal.dealId}
                  className={`cursor-pointer border-t border-ink/5 hover:bg-moss/5 ${active ? "bg-moss/10" : ""}`}
                  onClick={() => onSelect(deal)}
                >
                  <td className="px-4 py-2 font-semibold">{deal.dealId}</td>
                  <td className="num px-4 py-2">{deal.date}</td>
                  <td className="px-4 py-2">
                    {deal.neighborhood}
                    <span className="block text-xs text-ink/50">{deal.street}</span>
                  </td>
                  <td className="num px-4 py-2">{deal.rooms}</td>
                  <td className="num px-4 py-2">{deal.sqm}</td>
                  <td className="num px-4 py-2">{money(deal.priceNis)}</td>
                  <td className="num px-4 py-2 font-semibold">{money(deal.pricePerSqm)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
