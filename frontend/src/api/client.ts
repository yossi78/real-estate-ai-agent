import type { DealsResponse, GlobalMetrics, HealthResponse, InsightEvaluation, NeighborhoodStats } from "../types";

const EVALUATE_TIMEOUT_MS = 125_000;
const MAX_ERROR_CHARS = 280;
const GENERIC_ERROR = "בקשה נכשלה";
const SERVER_UNREACHABLE = "החיבור לשרת נקטע. רעננו את הדף או פתחו את הדשבורד מכתובת מקומית.";

function clampErrorMessage(message: string): string {
  const trimmed = message.trim();
  if (trimmed.length <= MAX_ERROR_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_ERROR_CHARS)}…`;
}

function looksLikeHtml(text: string, contentType: string): boolean {
  if (contentType.includes("text/html")) return true;
  return /<!doctype html/i.test(text) || /<html[\s>]/i.test(text);
}

function messageFromErrorBody(text: string, contentType: string, fallback: string): string {
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  if (looksLikeHtml(trimmed, contentType)) return SERVER_UNREACHABLE;

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as { message?: unknown };
      if (typeof parsed.message === "string" && parsed.message.trim()) {
        return clampErrorMessage(parsed.message);
      }
    } catch {
      // not JSON — fall through to a clamped plain-text message
    }
  }

  return clampErrorMessage(trimmed);
}

async function request<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { timeoutMs, ...fetchInit } = init ?? {};
  const controller = new AbortController();
  const timer = timeoutMs
    ? setTimeout(() => controller.abort(), timeoutMs)
    : undefined;

  try {
    const response = await fetch(path, { ...fetchInit, signal: controller.signal });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const contentType = response.headers.get("content-type") ?? "";
      throw new Error(
        messageFromErrorBody(text, contentType, response.statusText || GENERIC_ERROR),
      );
    }
    return response.json() as Promise<T>;
  } catch (error) {
    if (
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      throw new Error("הניתוח ארך יותר מדי. נסו שוב.");
    }
    if (error instanceof TypeError) {
      throw new Error(SERVER_UNREACHABLE);
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const api = {
  health: () => request<HealthResponse>("/health"),
  metrics: () => request<{ metricsSource: "calculated"; metrics: GlobalMetrics }>("/api/metrics"),
  neighborhood: (name: string) =>
    request<{ metricsSource: "calculated"; stats: NeighborhoodStats }>(
      `/api/metrics/neighborhoods/${encodeURIComponent(name)}`,
    ),
  deals: (params: { neighborhood?: string; page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.neighborhood) qs.set("neighborhood", params.neighborhood);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<DealsResponse>(`/api/deals${suffix}`);
  },
  evaluate: (body: { dealId?: string; neighborhood?: string }) =>
    request<InsightEvaluation>("/api/insights/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      timeoutMs: EVALUATE_TIMEOUT_MS,
    }),
  upload: async (file: File) => {
    const data = new FormData();
    data.append("file", file);
    return request<{ count: number; dropped: number }>("/api/deals/upload", {
      method: "POST",
      body: data,
    });
  },
  flushCache: () =>
    request<{ ok: true; message: string }>("/api/cache/flush", {
      method: "POST",
    }),
};
