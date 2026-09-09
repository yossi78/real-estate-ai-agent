import { logger } from "../../src/config/logger";

describe("logger", () => {
  const spies = {
    error: jest.spyOn(console, "error").mockImplementation(() => undefined),
    warn: jest.spyOn(console, "warn").mockImplementation(() => undefined),
    log: jest.spyOn(console, "log").mockImplementation(() => undefined),
  };

  afterAll(() => {
    spies.error.mockRestore();
    spies.warn.mockRestore();
    spies.log.mockRestore();
  });

  it("writes JSON lines to the matching console method", () => {
    logger.error("boom", { code: 1 });
    logger.warn("careful");
    logger.info("ok");
    logger.debug("trace");

    expect(JSON.parse(spies.error.mock.calls[0][0])).toMatchObject({ level: "error", message: "boom", code: 1 });
    expect(JSON.parse(spies.warn.mock.calls[0][0])).toMatchObject({ level: "warn", message: "careful" });
    expect(JSON.parse(spies.log.mock.calls[0][0])).toMatchObject({ level: "info", message: "ok" });
    expect(JSON.parse(spies.log.mock.calls[1][0])).toMatchObject({ level: "debug", message: "trace" });
  });
});
