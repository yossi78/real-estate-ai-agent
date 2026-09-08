interface Props {
  kind: "calculated" | "ai";
  extra?: string;
}

export function SourceBadge({ kind, extra }: Props) {
  if (kind === "calculated") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-moss/12 px-2.5 py-1 text-[11px] font-semibold text-mossDark">
        מדויק מהנתונים
        {extra ? <span className="font-normal text-moss/80">· {extra}</span> : null}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-clay/12 px-2.5 py-1 text-[11px] font-semibold text-clay">
      ניתוח AI
      {extra ? <span className="font-normal text-clay/80">· {extra}</span> : null}
    </span>
  );
}
