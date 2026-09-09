interface Props {
  kind: "calculated" | "ai";
  extra?: string;
}

export function SourceBadge({ kind, extra }: Props) {
  if (kind === "calculated") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        מדויק מהנתונים
        {extra ? <span className="font-normal text-slate-500">· {extra}</span> : null}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      ניתוח AI
      {extra ? <span className="font-normal text-emerald-400/70">· {extra}</span> : null}
    </span>
  );
}
