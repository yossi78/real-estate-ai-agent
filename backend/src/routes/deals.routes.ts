import { Router } from "express";
import multer from "multer";
import { ValidationError } from "../middleware/errorHandler";
import { ingestCsv, listDeals } from "../services/valuation/valuationService";

export const dealsRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

dealsRouter.get("/", async (req, res, next) => {
  try {
    const result = await listDeals({
      neighborhood: queryString(req.query.neighborhood),
      street: queryString(req.query.street),
      page: queryNumber(req.query.page),
      limit: queryNumber(req.query.limit),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

dealsRouter.post("/upload", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file?.buffer) {
      throw new ValidationError("יש לצרף קובץ CSV בשדה file");
    }
    const result = await ingestCsv(req.file.buffer);
    res.status(201).json({
      message: "הקובץ נטען בהצלחה",
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

function queryString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function queryNumber(value: unknown): number | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
