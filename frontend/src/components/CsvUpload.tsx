import { useState } from "react";
import { api } from "../api/client";
import { LoadingSpinner } from "./LoadingSpinner";

export function CsvUpload({ onUploaded }: { onUploaded: () => void }) {
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  return (
    <label className={`btn-secondary cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}>
      {busy && <LoadingSpinner size="sm" label="מעלה קובץ" className="text-slate-300" />}
      {busy ? "מעלה..." : "העלאת CSV"}
      <input
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        disabled={busy}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setBusy(true);
          setHint(null);
          try {
            const result = await api.upload(file);
            setHint(`${result.count} עסקאות נטענו`);
            onUploaded();
          } catch (error) {
            setHint(error instanceof Error ? error.message : "העלאה נכשלה");
          } finally {
            setBusy(false);
          }
        }}
      />
      {hint && <span className="text-xs font-normal text-slate-400">{hint}</span>}
    </label>
  );
}
