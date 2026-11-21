import { pool } from "../db/pool";
import * as invoiceQueries from "../db/queries/invoices";
import * as leaseQueries from "../db/queries/leases";
import * as paymentQueries from "../db/queries/payments";
import { NotFoundError } from "../lib/errors";
import { planApplications } from "./paymentApplication";

export interface RecordPaymentInput {
  leaseId: number;
  receivedOn: string;
  amountCents: number;
  reference: string;
}

/**
 * Record a payment from a tenant and apply it to their open invoices, oldest first.
 * Anything left over stays on the payment as unapplied credit.
 */
export async function recordPayment(input: RecordPaymentInput) {
  const lease = await leaseQueries.getLease(pool, input.leaseId);
  if (!lease) throw new NotFoundError(`Lease ${input.leaseId} not found`);

  const payment = await paymentQueries.insertPayment(pool, input);

  const openInvoices = await invoiceQueries.listOpenInvoices(pool, input.leaseId);
  const { applications } = planApplications(input.amountCents, openInvoices);
  for (const a of applications) {
    await paymentQueries.insertApplication(pool, payment.id, a.invoiceId, a.amountCents);
  }

  return getPaymentDetail(payment.id);
}

export async function getPaymentDetail(paymentId: number) {
  const payment = await paymentQueries.getPayment(pool, paymentId);
  if (!payment) throw new NotFoundError(`Payment ${paymentId} not found`);
  const applications = await paymentQueries.listApplications(pool, paymentId);
  return { ...payment, applications };
}
