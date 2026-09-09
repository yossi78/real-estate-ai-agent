describe("env parsing", () => {
  const snapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...snapshot };
  });

  function loadEnv() {
    let loaded: typeof import("../../src/config/env").env | undefined;
    jest.isolateModules(() => {
      loaded = require("../../src/config/env").env;
    });
    return loaded as typeof import("../../src/config/env").env;
  }

  it("uses defaults when values are missing or empty", () => {
    process.env.PORT = "";
    process.env.CACHE_TTL_SECONDS = "";
    process.env.CLUSTER_ENABLED = "";
    const env = loadEnv();
    expect(env.port).toBe(3001);
    expect(env.cacheTtlSeconds).toBe(86_400);
    expect(env.clusterEnabled).toBe(true);
  });

  it("parses numbers, invalid numbers, and booleans", () => {
    process.env.PORT = "4000";
    process.env.OLLAMA_TIMEOUT_MS = "not-a-number";
    process.env.CLUSTER_ENABLED = "true";
    process.env.NODE_ENV = "production";
    const env = loadEnv();
    expect(env.port).toBe(4000);
    expect(env.ollamaTimeoutMs).toBe(120000);
    expect(env.clusterEnabled).toBe(true);
    expect(env.isProduction).toBe(true);
  });

  it("treats 1 as true and other strings as false for booleans", () => {
    process.env.CLUSTER_ENABLED = "1";
    expect(loadEnv().clusterEnabled).toBe(true);
    process.env.CLUSTER_ENABLED = "false";
    expect(loadEnv().clusterEnabled).toBe(false);
  });
});
