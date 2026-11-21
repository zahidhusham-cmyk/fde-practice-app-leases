import { withTransaction } from "../db/pool";
import * as invoiceQueries from "../db/queries/invoices";
import * as leaseQueries from "../db/queries/leases";
import { monthName, type BillingMonth } from "../lib/dates";
import { rentForMonth } from "./proration";

/**
 * Create the monthly rent invoice for every lease that occupies its unit at any point in
 * the month. Safe to run more than once: a lease that already has a rent invoice for the
 * month is skipped. Rent is due on the 1st, or on the move-in date for a lease that
 * starts mid-month.
 */
export async function generateRentInvoices(month: BillingMonth) {
  return withTransaction(async (client) => {
    const leases = await leaseQueries.listLeasesActiveBetween(client, month.start, month.end);
    const created: invoiceQueries.InvoiceRow[] = [];
    let skipped = 0;

    for (const lease of leases) {
      const charge = rentForMonth(
        {
          startDate: lease.start_date,
          endDate: lease.end_date,
          monthlyRentCents: lease.monthly_rent_cents,
        },
        month,
      );
      if (!charge) continue;

      const description = charge.prorated
        ? `Rent, ${monthName(month)} (prorated, ${charge.daysBilled} days)`
        : `Rent, ${monthName(month)}`;
      const dueDate = lease.start_date > month.start ? lease.start_date : month.start;

      const invoice = await invoiceQueries.insertInvoiceIfMissing(client, {
        leaseId: lease.id,
        kind: "rent",
        periodStart: month.start,
        dueDate,
        amountCents: charge.amountCents,
        description,
      });
      if (invoice) created.push(invoice);
      else skipped += 1;
    }

    return {
      month: month.label,
      created_count: created.length,
      skipped_count: skipped,
      total_billed_cents: created.reduce((sum, i) => sum + i.amount_cents, 0),
      invoices: created,
    };
  });
}
