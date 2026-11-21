export interface OpenInvoice {
  id: number;
  open_cents: number;
}

export interface Application {
  invoiceId: number;
  amountCents: number;
}

/**
 * Decide how a payment is spread across a tenant's open invoices.
 * Invoices must already be in the order they should be paid (oldest first). Each invoice
 * is paid off in full before moving to the next; whatever is left over stays unapplied
 * as a credit on the payment.
 */
export function planApplications(
  paymentCents: number,
  openInvoices: OpenInvoice[],
): { applications: Application[]; unappliedCents: number } {
  const applications: Application[] = [];
  let remaining = paymentCents;
  for (const invoice of openInvoices) {
    if (remaining <= 0) break;
    if (invoice.open_cents <= 0) continue;
    const amountCents = Math.min(remaining, invoice.open_cents);
    applications.push({ invoiceId: invoice.id, amountCents });
    remaining -= amountCents;
  }
  return { applications, unappliedCents: remaining };
}
