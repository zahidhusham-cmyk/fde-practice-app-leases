import { pool } from "../db/pool";
import * as invoiceQueries from "../db/queries/invoices";
import * as leaseQueries from "../db/queries/leases";
import * as paymentQueries from "../db/queries/payments";
import { monthName, type BillingMonth } from "../lib/dates";
import { NotFoundError } from "../lib/errors";

async function requireLease(leaseId: number) {
  const lease = await leaseQueries.getLease(pool, leaseId);
  if (!lease) throw new NotFoundError(`Lease ${leaseId} not found`);
  return lease;
}

/** A lease with its invoices (oldest first), payments (newest first) and running totals. */
export async function getLeaseDetail(leaseId: number) {
  const lease = await requireLease(leaseId);
  const [invoices, payments, balance] = await Promise.all([
    invoiceQueries.listInvoicesForLease(pool, leaseId),
    paymentQueries.listPaymentsForLease(pool, leaseId),
    leaseQueries.getLeaseBalance(pool, leaseId),
  ]);
  return {
    lease,
    invoices,
    payments,
    totals: {
      ...balance,
      open_invoices_cents: invoices.reduce((sum, i) => sum + i.open_cents, 0),
      unapplied_credit_cents: payments.reduce((sum, p) => sum + p.unapplied_cents, 0),
    },
  };
}

/**
 * Monthly tenant statement: balance brought forward, charges due in the month, payments
 * received in the month, and the closing balance.
 */
export async function getMonthlyStatement(leaseId: number, month: BillingMonth) {
  const lease = await requireLease(leaseId);
  const [invoicedBefore, paidBefore, charges, payments] = await Promise.all([
    invoiceQueries.sumInvoicedBefore(pool, leaseId, month.start),
    paymentQueries.sumPaidBefore(pool, leaseId, month.start),
    invoiceQueries.listInvoicesDueBetween(pool, leaseId, month.start, month.end),
    paymentQueries.listPaymentsReceivedBetween(pool, leaseId, month.start, month.end),
  ]);

  const openingBalance = invoicedBefore - paidBefore;
  const chargesTotal = charges.reduce((sum, c) => sum + c.amount_cents, 0);
  const paymentsTotal = payments.reduce((sum, p) => sum + p.amount_cents, 0);

  return {
    lease,
    month: month.label,
    month_name: monthName(month),
    period: { start: month.start, end: month.end },
    opening_balance_cents: openingBalance,
    charges,
    charges_cents: chargesTotal,
    payments,
    payments_cents: paymentsTotal,
    closing_balance_cents: openingBalance + chargesTotal - paymentsTotal,
  };
}
