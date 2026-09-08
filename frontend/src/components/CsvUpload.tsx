import { useState } from "react";
import { api } from "../api/client";

export function CsvUpload({ onUploaded }: { onUploaded: () => void }) {
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  return (
    <label className="cursor-pointer rounded-xl border border-ink/15 bg-sand px-4 py-2 text-sm font-semibold hover:bg-white">
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
      {hint && <span className="mr-2 text-xs font-normal text-ink/60">{hint}</span>}
    </label>
  );
}
