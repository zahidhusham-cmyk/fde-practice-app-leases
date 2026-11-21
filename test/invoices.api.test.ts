import { describe, expect, it } from "vitest";
import { pool } from "../src/db/pool";
import { api, leaseIdByTenant, useFreshDatabase } from "./helpers";

useFreshDatabase();

async function leasesCoveringWholeMonth(start: string, end: string) {
  const { rows } = await pool.query<{ count: number; rent: number }>(
    `SELECT COUNT(*)::int AS count, COALESCE(SUM(monthly_rent_cents), 0)::bigint AS rent
       FROM leases WHERE start_date <= $1 AND end_date >= $2`,
    [start, end],
  );
  return rows[0]!;
}

describe("POST /api/invoices/generate", () => {
  it("bills a month's rent for every active lease", async () => {
    const expected = await leasesCoveringWholeMonth("2026-12-01", "2026-12-31");
    const res = await api().post("/api/invoices/generate").send({ month: "2026-12" }).expect(201);

    expect(res.body.month).toBe("2026-12");
    expect(res.body.created_count).toBe(18);
    expect(res.body.created_count).toBe(expected.count);
    expect(res.body.skipped_count).toBe(0);
    expect(res.body.total_billed_cents).toBe(expected.rent);
    for (const invoice of res.body.invoices) {
      expect(invoice).toMatchObject({ kind: "rent", period_start: "2026-12-01", due_date: "2026-12-01" });
      expect(invoice.description).toBe("Rent, December 2026");
    }
  });

  it("is safe to run twice for the same month", async () => {
    await api().post("/api/invoices/generate").send({ month: "2026-12" }).expect(201);
    const again = await api().post("/api/invoices/generate").send({ month: "2026-12" }).expect(200);
    expect(again.body).toMatchObject({ created_count: 0, skipped_count: 18, total_billed_cents: 0 });
  });

  it("skips a month that is already billed", async () => {
    const res = await api().post("/api/invoices/generate").send({ month: "2026-11" }).expect(200);
    expect(res.body).toMatchObject({ created_count: 0, skipped_count: 18 });
  });

  it("adds the new invoice to the tenant's balance", async () => {
    const leaseId = await leaseIdByTenant("Tidewater Coffee Co.");
    const before = await api().get(`/api/leases/${leaseId}`).expect(200);
    await api().post("/api/invoices/generate").send({ month: "2026-12" }).expect(201);
    const after = await api().get(`/api/leases/${leaseId}`).expect(200);

    expect(after.body.totals.balance_cents - before.body.totals.balance_cents).toBe(4_850_00);
    expect(after.body.invoices.at(-1)).toMatchObject({ due_date: "2026-12-01", open_cents: 4_850_00 });
  });

  it("rejects a malformed month", async () => {
    for (const month of ["2026-13", "Dec 2026", undefined]) {
      const res = await api().post("/api/invoices/generate").send({ month }).expect(400);
      expect(res.body.error).toMatch(/month/);
    }
  });
});
