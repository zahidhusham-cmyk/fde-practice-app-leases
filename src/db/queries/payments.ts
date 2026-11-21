import type { Db } from "../pool";

export interface PaymentRow {
  id: number;
  lease_id: number;
  received_on: string;
  amount_cents: number;
  reference: string;
}

export interface PaymentWithAppliedRow extends PaymentRow {
  applied_cents: number;
  unapplied_cents: number;
}

export interface PaymentApplicationRow {
  invoice_id: number;
  invoice_description: string;
  amount_cents: number;
}

export async function insertPayment(
  db: Db,
  payment: { leaseId: number; receivedOn: string; amountCents: number; reference: string },
): Promise<PaymentRow> {
  const { rows } = await db.query<PaymentRow>(
    `INSERT INTO payments (lease_id, received_on, amount_cents, reference)
     VALUES ($1, $2, $3, $4)
     RETURNING id, lease_id, received_on, amount_cents, reference`,
    [payment.leaseId, payment.receivedOn, payment.amountCents, payment.reference],
  );
  return rows[0]!;
}

export async function insertApplication(
  db: Db,
  paymentId: number,
  invoiceId: number,
  amountCents: number,
): Promise<void> {
  await db.query(
    `INSERT INTO payment_applications (payment_id, invoice_id, amount_cents) VALUES ($1, $2, $3)`,
    [paymentId, invoiceId, amountCents],
  );
}

const WITH_APPLIED = `
  SELECT p.id, p.lease_id, p.received_on, p.amount_cents, p.reference,
         COALESCE(SUM(pa.amount_cents), 0)::bigint AS applied_cents,
         (p.amount_cents - COALESCE(SUM(pa.amount_cents), 0))::bigint AS unapplied_cents
    FROM payments p
    LEFT JOIN payment_applications pa ON pa.payment_id = p.id`;

export async function getPayment(db: Db, paymentId: number): Promise<PaymentWithAppliedRow | null> {
  const { rows } = await db.query<PaymentWithAppliedRow>(
    `${WITH_APPLIED} WHERE p.id = $1 GROUP BY p.id`,
    [paymentId],
  );
  return rows[0] ?? null;
}

/** A lease's payments, newest first. */
export async function listPaymentsForLease(db: Db, leaseId: number): Promise<PaymentWithAppliedRow[]> {
  const { rows } = await db.query<PaymentWithAppliedRow>(
    `${WITH_APPLIED} WHERE p.lease_id = $1 GROUP BY p.id ORDER BY p.received_on DESC, p.id DESC`,
    [leaseId],
  );
  return rows;
}

export async function listApplications(db: Db, paymentId: number): Promise<PaymentApplicationRow[]> {
  const { rows } = await db.query<PaymentApplicationRow>(
    `SELECT pa.invoice_id, i.description AS invoice_description, pa.amount_cents
       FROM payment_applications pa
       JOIN invoices i ON i.id = pa.invoice_id
      WHERE pa.payment_id = $1
      ORDER BY pa.id`,
    [paymentId],
  );
  return rows;
}

/** Payments received between start and end (inclusive), oldest first. */
export async function listPaymentsReceivedBetween(
  db: Db,
  leaseId: number,
  start: string,
  end: string,
): Promise<PaymentRow[]> {
  const { rows } = await db.query<PaymentRow>(
    `SELECT id, lease_id, received_on, amount_cents, reference
       FROM payments
      WHERE lease_id = $1 AND received_on >= $2 AND received_on <= $3
      ORDER BY received_on, id`,
    [leaseId, start, end],
  );
  return rows;
}

export async function sumPaidBefore(db: Db, leaseId: number, date: string): Promise<number> {
  const { rows } = await db.query<{ total: number }>(
    `SELECT COALESCE(SUM(amount_cents), 0)::bigint AS total
       FROM payments WHERE lease_id = $1 AND received_on < $2`,
    [leaseId, date],
  );
  return rows[0]!.total;
}
