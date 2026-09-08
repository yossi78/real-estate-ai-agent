import { env } from "../../config/env";
import { logger } from "../../config/logger";
import type { LlmPromptPayload } from "../../types/domain";
import { LLM_OUTPUT_JSON_SCHEMA } from "./schema";

export class LlmTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`OLLAMA_TIMEOUT_${timeoutMs}`);
    this.name = "LlmTimeoutError";
  }
}

export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmUnavailableError";
  }
}

interface OllamaChatResponse {
  message?: { content?: string };
  response?: string;
}

export async function completeJsonChat(
  prompt: LlmPromptPayload,
  options?: { timeoutMs?: number; model?: string },
): Promise<string> {
  const timeoutMs = options?.timeoutMs ?? env.ollamaTimeoutMs;
  const model = options?.model ?? env.ollamaModel;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${env.ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        format: LLM_OUTPUT_JSON_SCHEMA,
        options: {
          temperature: prompt.temperature,
          num_predict: 400,
        },
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new LlmUnavailableError(`OLLAMA_HTTP_${response.status}:${body.slice(0, 180)}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    const rawContent = data.message?.content ?? data.response ?? "";
    const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    if (!content.trim()) {
      throw new LlmUnavailableError("OLLAMA_EMPTY_CONTENT");
    }
    return content;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new LlmTimeoutError(timeoutMs);
    }
    if (error instanceof LlmTimeoutError || error instanceof LlmUnavailableError) {
      throw error;
    }
    logger.warn("ollama_request_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    throw new LlmUnavailableError(error instanceof Error ? error.message : "OLLAMA_UNAVAILABLE");
  } finally {
    clearTimeout(timer);
  }
}

interface OllamaTagsResponse {
  models?: Array<{ name?: string; model?: string }>;
}

export async function pingOllama(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(`${env.ollamaBaseUrl}/api/tags`, { signal: controller.signal });
    if (!response.ok) return false;
    const data = (await response.json()) as OllamaTagsResponse;
    const wanted = env.ollamaModel.toLowerCase();
    return (data.models ?? []).some((entry) => {
      const name = (entry.name ?? entry.model ?? "").toLowerCase();
      return name === wanted || name.split(":")[0] === wanted;
    });
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
