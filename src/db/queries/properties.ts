import type { Db } from "../pool";

export interface PropertyRow {
  id: number;
  name: string;
  address: string;
  kind: string;
}

export interface PropertyListRow extends PropertyRow {
  unit_count: number;
  occupied_units: number;
  monthly_rent_cents: number;
}

export interface UnitRow {
  id: number;
  property_id: number;
  unit_number: string;
  square_feet: number;
}

/** Every property with its unit count, occupied units and contracted rent as of a date. */
export async function listProperties(db: Db, asOf: string): Promise<PropertyListRow[]> {
  const { rows } = await db.query<PropertyListRow>(
    `SELECT p.id, p.name, p.address, p.kind,
            COUNT(DISTINCT u.id)::int AS unit_count,
            COUNT(DISTINCT l.id)::int AS occupied_units,
            COALESCE(SUM(l.monthly_rent_cents), 0)::bigint AS monthly_rent_cents
       FROM properties p
       LEFT JOIN units u ON u.property_id = p.id
       LEFT JOIN leases l ON l.unit_id = u.id AND l.start_date <= $1 AND l.end_date >= $1
      GROUP BY p.id
      ORDER BY p.name`,
    [asOf],
  );
  return rows;
}

export async function getProperty(db: Db, propertyId: number): Promise<PropertyRow | null> {
  const { rows } = await db.query<PropertyRow>(
    `SELECT id, name, address, kind FROM properties WHERE id = $1`,
    [propertyId],
  );
  return rows[0] ?? null;
}

export async function listUnits(db: Db, propertyId: number): Promise<UnitRow[]> {
  const { rows } = await db.query<UnitRow>(
    `SELECT id, property_id, unit_number, square_feet
       FROM units
      WHERE property_id = $1
      ORDER BY unit_number`,
    [propertyId],
  );
  return rows;
}
