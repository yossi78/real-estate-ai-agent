import { useState } from "react";
import { api } from "../api/client";
import { LoadingSpinner } from "./LoadingSpinner";

export function ClearCacheButton({
  disabled,
  onCleared,
}: {
  disabled?: boolean;
  onCleared: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  return (
    <button
      type="button"
      className="btn-secondary"
      disabled={busy || disabled}
      title={hint ?? undefined}
      onClick={async () => {
        setBusy(true);
        setHint(null);
        try {
          const result = await api.flushCache();
          setHint(result.message);
          onCleared();
        } catch (error) {
          setHint(error instanceof Error ? error.message : "ניקוי המטמון נכשל");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy && <LoadingSpinner size="sm" label="מנקה מטמון" className="text-slate-300" />}
      {busy ? "מנקה..." : "נקה מטמון"}
      {hint && <span className="text-xs font-normal text-slate-400">{hint}</span>}
    </button>
  );
}
