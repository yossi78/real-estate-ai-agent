import { completeJsonChat, LlmTimeoutError, LlmUnavailableError, pingOllama } from "../../src/services/llm/ollamaClient";
import type { LlmPromptPayload } from "../../src/types/domain";

const prompt: LlmPromptPayload = {
  system: "sys",
  user: "user",
  temperature: 0.1,
  format: "json",
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as Response;
}

describe("ollamaClient", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns message.content from a successful chat response", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ message: { content: '{"ok":true}' } }));
    await expect(completeJsonChat(prompt)).resolves.toBe('{"ok":true}');
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.format).toMatchObject({ type: "object" });
    expect(body.stream).toBe(false);
    expect(body.options.temperature).toBe(0.1);
    expect(body.options.num_predict).toBe(400);
    expect(body.messages).toHaveLength(2);
  });

  it("stringifies object content from Ollama", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ message: { content: { ok: true } } }));
    await expect(completeJsonChat(prompt)).resolves.toBe('{"ok":true}');
  });

  it("falls back to the response field when message.content is missing", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ response: '{"alt":true}' }));
    await expect(completeJsonChat(prompt)).resolves.toBe('{"alt":true}');
  });

  it("throws LlmUnavailableError on empty content", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ message: { content: "  " } }));
    await expect(completeJsonChat(prompt)).rejects.toBeInstanceOf(LlmUnavailableError);

    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({}));
    await expect(completeJsonChat(prompt)).rejects.toMatchObject({ message: "OLLAMA_EMPTY_CONTENT" });
  });

  it("throws LlmUnavailableError on HTTP errors", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse("nope", 500));
    await expect(completeJsonChat(prompt)).rejects.toMatchObject({
      name: "LlmUnavailableError",
      message: expect.stringContaining("OLLAMA_HTTP_500"),
    });
  });

  it("maps AbortError to LlmTimeoutError", async () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    (global.fetch as jest.Mock).mockRejectedValue(abort);
    await expect(completeJsonChat(prompt, { timeoutMs: 10 })).rejects.toBeInstanceOf(LlmTimeoutError);
  });

  it("wraps network failures as LlmUnavailableError", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(completeJsonChat(prompt)).rejects.toMatchObject({
      name: "LlmUnavailableError",
      message: "ECONNREFUSED",
    });
  });

  it("wraps non-Error failures as LlmUnavailableError", async () => {
    (global.fetch as jest.Mock).mockRejectedValue("offline");
    await expect(completeJsonChat(prompt)).rejects.toMatchObject({
      message: "OLLAMA_UNAVAILABLE",
    });
  });

  it("pings Ollama successfully and returns false on failure", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({ models: [{ name: "llama3:8b" }] }),
    );
    await expect(pingOllama()).resolves.toBe(true);
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ models: [] }));
    await expect(pingOllama()).resolves.toBe(false);
    (global.fetch as jest.Mock).mockRejectedValue(new Error("down"));
    await expect(pingOllama()).resolves.toBe(false);
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false } as Response);
    await expect(pingOllama()).resolves.toBe(false);
  });
});
