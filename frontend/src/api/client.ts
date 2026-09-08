import type { DealsResponse, GlobalMetrics, HealthResponse, InsightEvaluation, NeighborhoodStats } from "../types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error((body as { message?: string }).message ?? "בקשה נכשלה");
  }
  return response.json() as Promise<T>;
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
    }),
  upload: async (file: File) => {
    const data = new FormData();
    data.append("file", file);
    return request<{ count: number; dropped: number }>("/api/deals/upload", {
      method: "POST",
      body: data,
    });
  },
};
