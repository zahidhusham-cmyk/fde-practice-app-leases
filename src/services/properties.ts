import { pool } from "../db/pool";
import * as leaseQueries from "../db/queries/leases";
import * as propertyQueries from "../db/queries/properties";
import { NotFoundError } from "../lib/errors";

export async function listProperties(asOf: string) {
  return propertyQueries.listProperties(pool, asOf);
}

/**
 * The rent roll: every unit in a property, who occupies it on `asOf`, their rent and
 * what they currently owe.
 */
export async function getRentRoll(propertyId: number, asOf: string) {
  const property = await propertyQueries.getProperty(pool, propertyId);
  if (!property) throw new NotFoundError(`Property ${propertyId} not found`);

  const units = await propertyQueries.listUnits(pool, propertyId);
  const rows = [];
  for (const unit of units) {
    const lease = await leaseQueries.getLeaseForUnitOn(pool, unit.id, asOf);
    if (!lease) {
      rows.push({ ...unit, lease: null });
      continue;
    }
    const balance = await leaseQueries.getLeaseBalance(pool, lease.id);
    rows.push({
      ...unit,
      lease: {
        id: lease.id,
        tenant_id: lease.tenant_id,
        tenant_name: lease.tenant_name,
        start_date: lease.start_date,
        end_date: lease.end_date,
        monthly_rent_cents: lease.monthly_rent_cents,
        balance_cents: balance.balance_cents,
      },
    });
  }

  const occupied = rows.filter((r) => r.lease !== null);
  return {
    property,
    as_of: asOf,
    units: rows,
    totals: {
      unit_count: rows.length,
      occupied_units: occupied.length,
      monthly_rent_cents: occupied.reduce((sum, r) => sum + (r.lease?.monthly_rent_cents ?? 0), 0),
      balance_cents: occupied.reduce((sum, r) => sum + (r.lease?.balance_cents ?? 0), 0),
    },
  };
}
