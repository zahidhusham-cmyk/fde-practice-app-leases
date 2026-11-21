import { afterAll, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { pool } from "../src/db/pool";
import { resetDatabase } from "../src/db/reset";

/** Call once at the top of an API test file: fresh schema + seed before every test. */
export function useFreshDatabase() {
  beforeEach(async () => {
    await resetDatabase();
  });
  afterAll(async () => {
    await pool.end();
  });
}

export const api = () => request(createApp());

export async function propertyIdByName(name: string): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(`SELECT id FROM properties WHERE name = $1`, [name]);
  if (!rows[0]) throw new Error(`No seeded property named ${name}`);
  return rows[0].id;
}

/** The (single) seeded lease for a tenant. */
export async function leaseIdByTenant(name: string): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `SELECT l.id FROM leases l JOIN tenants t ON t.id = l.tenant_id WHERE t.name = $1`,
    [name],
  );
  if (!rows[0]) throw new Error(`No seeded lease for tenant ${name}`);
  return rows[0].id;
}

export const sumCents = (rows: { amount_cents: number }[]) =>
  rows.reduce((total, r) => total + r.amount_cents, 0);
