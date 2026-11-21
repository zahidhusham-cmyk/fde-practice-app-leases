import type { Db } from "../pool";

export interface InvoiceRow {
  id: number;
  lease_id: number;
  kind: string;
  period_start: string;
  due_date: string;
  amount_cents: number;
  description: string;
}

export interface InvoiceWithPaymentsRow extends InvoiceRow {
  paid_cents: number;
  open_cents: number;
}

/** Insert an invoice unless this lease already has one of this kind for this period. Returns null if skipped. */
export async function insertInvoiceIfMissing(
  db: Db,
  invoice: {
    leaseId: number;
    kind: string;
    periodStart: string;
    dueDate: string;
    amountCents: number;
    description: string;
  },
): Promise<InvoiceRow | null> {
  const { rows } = await db.query<InvoiceRow>(
    `INSERT INTO invoices (lease_id, kind, period_start, due_date, amount_cents, description)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (lease_id, kind, period_start) DO NOTHING
     RETURNING id, lease_id, kind, period_start, due_date, amount_cents, description`,
    [
      invoice.leaseId,
      invoice.kind,
      invoice.periodStart,
      invoice.dueDate,
      invoice.amountCents,
      invoice.description,
    ],
  );
  return rows[0] ?? null;
}

/** A lease's invoices, oldest first, with how much of each has been paid. */
export async function listInvoicesForLease(db: Db, leaseId: number): Promise<InvoiceWithPaymentsRow[]> {
  const { rows } = await db.query<InvoiceWithPaymentsRow>(
    `SELECT i.id, i.lease_id, i.kind, i.period_start, i.due_date, i.amount_cents, i.description,
            COALESCE(SUM(pa.amount_cents), 0)::bigint AS paid_cents,
            (i.amount_cents - COALESCE(SUM(pa.amount_cents), 0))::bigint AS open_cents
       FROM invoices i
       LEFT JOIN payment_applications pa ON pa.invoice_id = i.id
      WHERE i.lease_id = $1
      GROUP BY i.id
      ORDER BY i.due_date, i.id`,
    [leaseId],
  );
  return rows;
}

/** Invoices for a lease that still have something owing, in the order they should be paid. */
export async function listOpenInvoices(db: Db, leaseId: number): Promise<InvoiceWithPaymentsRow[]> {
  const invoices = await listInvoicesForLease(db, leaseId);
  return invoices.filter((i) => i.open_cents > 0);
}

/** Invoices whose due date falls between start and end (inclusive). */
export async function listInvoicesDueBetween(
  db: Db,
  leaseId: number,
  start: string,
  end: string,
): Promise<InvoiceRow[]> {
  const { rows } = await db.query<InvoiceRow>(
    `SELECT id, lease_id, kind, period_start, due_date, amount_cents, description
       FROM invoices
      WHERE lease_id = $1 AND due_date >= $2 AND due_date <= $3
      ORDER BY due_date, id`,
    [leaseId, start, end],
  );
  return rows;
}

/** Total invoiced to a lease with a due date before `date`. */
export async function sumInvoicedBefore(db: Db, leaseId: number, date: string): Promise<number> {
  const { rows } = await db.query<{ total: number }>(
    `SELECT COALESCE(SUM(amount_cents), 0)::bigint AS total
       FROM invoices WHERE lease_id = $1 AND due_date < $2`,
    [leaseId, date],
  );
  return rows[0]!.total;
}
