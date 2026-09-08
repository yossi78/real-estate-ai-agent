import { cacheKey, hashPayload } from "../../src/services/cache/redisClient";

describe("redisClient helpers", () => {
  it("joins cache key parts and replaces colons", () => {
    expect(cacheKey(["stats", "neighborhood", "tel:aviv", "foo"])).toBe("stats:neighborhood:tel_aviv:foo");
  });

  it("hashes payloads stably and distinguishes different inputs", () => {
    const a = hashPayload({ n: "פלורנטין", v: 1 });
    const b = hashPayload({ n: "פלורנטין", v: 1 });
    const c = hashPayload({ n: "פלורנטין", v: 2 });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(24);
  });
});
