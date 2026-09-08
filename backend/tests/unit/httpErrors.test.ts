import { AppError, NotFoundError, ValidationError } from "../../src/middleware/errorHandler";
import { errorHandler, notFoundHandler } from "../../src/middleware/httpErrors";
import type { NextFunction, Request, Response } from "express";

jest.mock("../../src/config/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

function mockRes(): Response {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res as unknown as Response;
}

describe("error classes", () => {
  it("exposes status codes and error codes", () => {
    const app = new AppError(418, "nope", "TEAPOT");
    expect(app.statusCode).toBe(418);
    expect(app.code).toBe("TEAPOT");
    expect(new AppError(500, "x").code).toBe("APP_ERROR");

    const missing = new NotFoundError("gone");
    expect(missing.statusCode).toBe(404);
    expect(missing.code).toBe("NOT_FOUND");

    const invalid = new ValidationError("bad");
    expect(invalid.statusCode).toBe(400);
    expect(invalid.code).toBe("VALIDATION_ERROR");
  });
});

describe("http error middleware", () => {
  it("returns 404 for unknown routes", () => {
    const res = mockRes();
    notFoundHandler({} as Request, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "NOT_FOUND", message: "הנתיב לא נמצא" });
  });

  it("serializes AppError instances", () => {
    const res = mockRes();
    errorHandler(new ValidationError("חסר שדה"), {} as Request, res, (() => undefined) as NextFunction);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "VALIDATION_ERROR", message: "חסר שדה" });
  });

  it("hides unexpected errors behind a generic 500", () => {
    const res = mockRes();
    errorHandler(new Error("secret"), {} as Request, res, (() => undefined) as NextFunction);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "INTERNAL_ERROR", message: "שגיאה פנימית בשרת" });
  });

  it("handles non-Error throws", () => {
    const res = mockRes();
    errorHandler("boom", {} as Request, res, (() => undefined) as NextFunction);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
