import { Router } from "express";
import { z } from "zod";
import { ValidationError } from "../middleware/errorHandler";
import { evaluateSubject } from "../services/valuation/valuationService";

export const insightsRouter = Router();

const bodySchema = z
  .object({
    dealId: z.string().min(1).optional(),
    neighborhood: z.string().min(1).optional(),
  })
  .refine((v) => Boolean(v.dealId || v.neighborhood), {
    message: "יש לספק dealId או neighborhood",
  });

insightsRouter.post("/evaluate", async (req, res, next) => {
  try {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "גוף בקשה לא תקין");
    }
    const evaluation = await evaluateSubject(parsed.data);
    res.json(evaluation);
  } catch (error) {
    next(error);
  }
});
