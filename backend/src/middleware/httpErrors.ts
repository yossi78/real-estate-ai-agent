import type { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler";
import { logger } from "../config/logger";

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "NOT_FOUND", message: "הנתיב לא נמצא" });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.code, message: err.message });
    return;
  }

  logger.error("unhandled_error", {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  res.status(500).json({
    error: "INTERNAL_ERROR",
    message: "שגיאה פנימית בשרת",
  });
}
