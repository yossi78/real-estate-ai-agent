import type { NextFunction, Request, Response } from "express";
import { flushAllCache } from "../../src/services/cache/cacheService";
import { persistCorpus } from "../../src/store/dealStore";
import { cacheRouter } from "../../src/routes/cache.routes";

jest.mock("../../src/services/cache/cacheService", () => ({
  flushAllCache: jest.fn(),
}));

jest.mock("../../src/store/dealStore", () => ({
  persistCorpus: jest.fn(),
}));

const mockedFlush = flushAllCache as jest.MockedFunction<typeof flushAllCache>;
const mockedPersist = persistCorpus as jest.MockedFunction<typeof persistCorpus>;

function mockRes(): Response {
  const res = {
    json: jest.fn(),
    status: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res as unknown as Response;
}

function flushHandler() {
  const layer = cacheRouter.stack.find((entry) => entry.route?.path === "/flush");
  const handler = layer?.route?.stack[0]?.handle as (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => Promise<void>;
  if (!handler) throw new Error("flush handler missing");
  return handler;
}

describe("cache routes", () => {
  beforeEach(() => {
    mockedFlush.mockReset();
    mockedPersist.mockReset().mockResolvedValue(undefined);
  });

  it("returns the flush confirmation and restores the deals corpus", async () => {
    mockedFlush.mockResolvedValue({ ok: true, message: "המטמון נוקה" });
    const res = mockRes();
    const next = jest.fn() as NextFunction;
    await flushHandler()({} as Request, res, next);
    expect(mockedPersist).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, message: "המטמון נוקה" });
    expect(next).not.toHaveBeenCalled();
  });

  it("forwards flush failures to error middleware without rewriting Redis", async () => {
    const err = new Error("down");
    mockedFlush.mockRejectedValue(err);
    const res = mockRes();
    const next = jest.fn() as NextFunction;
    await flushHandler()({} as Request, res, next);
    expect(mockedPersist).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(err);
    expect(res.json).not.toHaveBeenCalled();
  });
});
