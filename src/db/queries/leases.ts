import type { Db } from "../pool";

export interface LeaseRow {
  id: number;
  unit_id: number;
  tenant_id: number;
  start_date: string;
  end_date: string;
  monthly_rent_cents: number;
}

export interface LeaseDetailRow extends LeaseRow {
  tenant_name: string;
  contact_email: string;
  unit_number: string;
  property_id: number;
  property_name: string;
}

export interface LeaseBalanceRow {
  billed_cents: number;
  paid_cents: number;
  balance_cents: number;
}

const DETAIL_COLUMNS = `
  l.id, l.unit_id, l.tenant_id, l.start_date, l.end_date, l.monthly_rent_cents,
  t.name AS tenant_name, t.contact_email,
  u.unit_number, p.id AS property_id, p.name AS property_name`;

const DETAIL_JOINS = `
  FROM leases l
  JOIN tenants t ON t.id = l.tenant_id
  JOIN units u ON u.id = l.unit_id
  JOIN properties p ON p.id = u.property_id`;

export async function getLease(db: Db, leaseId: number): Promise<LeaseDetailRow | null> {
  const { rows } = await db.query<LeaseDetailRow>(
    `SELECT ${DETAIL_COLUMNS} ${DETAIL_JOINS} WHERE l.id = $1`,
    [leaseId],
  );
  return rows[0] ?? null;
}

/** The lease occupying a unit on a given date, if any. */
export async function getLeaseForUnitOn(
  db: Db,
  unitId: number,
  date: string,
): Promise<LeaseDetailRow | null> {
  const { rows } = await db.query<LeaseDetailRow>(
    `SELECT ${DETAIL_COLUMNS} ${DETAIL_JOINS}
      WHERE l.unit_id = $1 AND l.start_date <= $2 AND l.end_date >= $2
      ORDER BY l.start_date DESC
      LIMIT 1`,
    [unitId, date],
  );
  return rows[0] ?? null;
}

/** Leases that occupy their unit for at least one day between start and end (inclusive). */
export async function listLeasesActiveBetween(db: Db, start: string, end: string): Promise<LeaseRow[]> {
  const { rows } = await db.query<LeaseRow>(
    `SELECT id, unit_id, tenant_id, start_date, end_date, monthly_rent_cents
       FROM leases
      WHERE start_date <= $2 AND end_date >= $1
      ORDER BY id`,
    [start, end],
  );
  return rows;
}

/** Everything ever billed to a lease minus everything it has paid. Negative = tenant in credit. */
export async function getLeaseBalance(db: Db, leaseId: number): Promise<LeaseBalanceRow> {
  const { rows } = await db.query<LeaseBalanceRow>(
    `SELECT b.billed_cents, p.paid_cents, (b.billed_cents - p.paid_cents)::bigint AS balance_cents
       FROM (SELECT COALESCE(SUM(amount_cents), 0)::bigint AS billed_cents
               FROM invoices WHERE lease_id = $1) b,
            (SELECT COALESCE(SUM(amount_cents), 0)::bigint AS paid_cents
               FROM payments WHERE lease_id = $1) p`,
    [leaseId],
  );
  return rows[0]!;
}
