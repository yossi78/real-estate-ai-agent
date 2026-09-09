type Level = "info" | "warn" | "error" | "debug";

function emit(level: Level, message: string, extra?: Record<string, unknown>): void {
  const line = {
    ts: new Date().toISOString(),
    level,
    message,
    ...extra,
  };
  const serialized = JSON.stringify(line);
  if (level === "error") {
    console.error(serialized);
    return;
  }
  if (level === "warn") {
    console.warn(serialized);
    return;
  }
  console.log(serialized);
}

export const logger = {
  info: (message: string, extra?: Record<string, unknown>) => emit("info", message, extra),
  warn: (message: string, extra?: Record<string, unknown>) => emit("warn", message, extra),
  error: (message: string, extra?: Record<string, unknown>) => emit("error", message, extra),
  debug: (message: string, extra?: Record<string, unknown>) => emit("debug", message, extra),
};
