import { useEffect, useState } from "react";

const sizePx = {
  sm: 16,
  md: 24,
  lg: 56,
  xl: 112,
} as const;

function useElapsedSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const started = Date.now();
    setSeconds(0);
    const id = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - started) / 1000));
    }, 200);
    return () => window.clearInterval(id);
  }, [active]);

  return seconds;
}

function elapsedLabel(seconds: number): string {
  if (seconds === 1) return "שנייה אחת";
  return `${seconds} שניות`;
}

export function LoadingSpinner({
  size = "md",
  label,
  className = "text-emerald-400",
  timed = false,
}: {
  size?: keyof typeof sizePx;
  label?: string;
  className?: string;
  timed?: boolean;
}) {
  const px = sizePx[size];
  const elapsed = useElapsedSeconds(timed);
  const stroke = size === "xl" ? 2.25 : 3;

  return (
    <span className="inline-flex flex-col items-center gap-3" role="status" aria-live="polite">
      <span className="relative inline-flex items-center justify-center" style={{ width: px, height: px }}>
        <svg
          className={`absolute inset-0 animate-spin ${className}`}
          width={px}
          height={px}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle className="opacity-20" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={stroke} />
          <path
            d="M21 12a9 9 0 0 0-9-9"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        </svg>
        {timed && (
          <span className="num text-3xl font-extrabold leading-none text-emerald-300">{elapsed}</span>
        )}
      </span>
      {timed && (
        <span className="text-sm font-semibold tabular-nums text-slate-400">{elapsedLabel(elapsed)}</span>
      )}
      <span className="sr-only">{label ?? "טוען"}{timed ? ` ${elapsedLabel(elapsed)}` : ""}</span>
    </span>
  );
}
