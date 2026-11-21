import { Router } from "express";
import * as leases from "../services/leases";
import * as payments from "../services/payments";
import { parseMonth } from "../lib/dates";
import { parseAmountCents, parseDate, parseId, parseOptionalText } from "../lib/validation";

export const leasesRouter = Router();

leasesRouter.get("/:leaseId", async (req, res) => {
  res.json(await leases.getLeaseDetail(parseId(req.params.leaseId, "leaseId")));
});

leasesRouter.get("/:leaseId/statements/:month", async (req, res) => {
  res.json(
    await leases.getMonthlyStatement(parseId(req.params.leaseId, "leaseId"), parseMonth(req.params.month)),
  );
});

leasesRouter.post("/:leaseId/payments", async (req, res) => {
  const body = req.body ?? {};
  const payment = await payments.recordPayment({
    leaseId: parseId(req.params.leaseId, "leaseId"),
    receivedOn: parseDate(body.received_on, "received_on"),
    amountCents: parseAmountCents(body.amount_cents),
    reference: parseOptionalText(body.reference, "reference", 100),
  });
  res.status(201).json(payment);
});
