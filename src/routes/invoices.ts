import { Router } from "express";
import * as invoices from "../services/invoices";
import { parseMonth } from "../lib/dates";

export const invoicesRouter = Router();

/** Bill rent for a month: { "month": "2026-12" }. Re-running for the same month is a no-op. */
invoicesRouter.post("/generate", async (req, res) => {
  const body = req.body ?? {};
  const result = await invoices.generateRentInvoices(parseMonth(body.month));
  res.status(result.created_count > 0 ? 201 : 200).json(result);
});
