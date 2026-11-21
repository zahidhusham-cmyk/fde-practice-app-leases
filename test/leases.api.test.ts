import { describe, expect, it } from "vitest";
import { pool } from "../src/db/pool";
import { api, leaseIdByTenant, sumCents, useFreshDatabase } from "./helpers";

useFreshDatabase();

describe("GET /api/leases/:leaseId", () => {
  it("returns invoices oldest first, payments newest first, and totals that reconcile", async () => {
    // Alder pays a flat 7,000.00 a month against 9,300.00 rent, so it falls further behind each month.
    const leaseId = await leaseIdByTenant("Alder Brewing Company");
    const res = await api().get(`/api/leases/${leaseId}`).expect(200);
    const { lease, invoices, payments, totals } = res.body;

    expect(lease).toMatchObject({ tenant_name: "Alder Brewing Company", unit_number: "Bay D", monthly_rent_cents: 9_300_00 });
    expect(invoices).toHaveLength(11);
    expect(invoices[0].due_date).toBe("2026-01-01");
    expect(payments[0].received_on > payments.at(-1).received_on).toBe(true);

    expect(totals.billed_cents).toBe(sumCents(invoices));
    expect(totals.paid_cents).toBe(sumCents(payments));
    expect(totals.balance_cents).toBe(11 * (9_300_00 - 7_000_00));
    expect(totals.open_invoices_cents).toBe(totals.balance_cents);
  });

  it("shows an overpaying tenant in credit", async () => {
    const leaseId = await leaseIdByTenant("Fern & Fig Florist");
    const res = await api().get(`/api/leases/${leaseId}`).expect(200);
    expect(res.body.totals).toMatchObject({
      balance_cents: -1_100_00,
      open_invoices_cents: 0,
      unapplied_credit_cents: 1_100_00,
    });
  });

  it("returns 404 for an unknown lease", async () => {
    await api().get("/api/leases/9999").expect(404);
  });
});

describe("GET /api/leases/:leaseId/statements/:month", () => {
  it("brings forward the unpaid balance and adds the month's activity", async () => {
    const leaseId = await leaseIdByTenant("Copperleaf Insurance Agency");
    const res = await api().get(`/api/leases/${leaseId}/statements/2026-10`).expect(200);
    expect(res.body).toMatchObject({
      month: "2026-10",
      month_name: "October 2026",
      period: { start: "2026-10-01", end: "2026-10-31" },
      opening_balance_cents: 8_600_00,
      charges_cents: 8_600_00,
      payments_cents: 0,
      closing_balance_cents: 17_200_00,
    });
    expect(res.body.charges).toHaveLength(1);
  });

  it("chains month to month and ends at the current balance for every lease", async () => {
    const { rows } = await pool.query<{ id: number }>(`SELECT id FROM leases ORDER BY id`);
    for (const { id } of rows) {
      const oct = await api().get(`/api/leases/${id}/statements/2026-10`).expect(200);
      const nov = await api().get(`/api/leases/${id}/statements/2026-11`).expect(200);
      const detail = await api().get(`/api/leases/${id}`).expect(200);
      expect(nov.body.opening_balance_cents).toBe(oct.body.closing_balance_cents);
      expect(nov.body.closing_balance_cents).toBe(detail.body.totals.balance_cents);
    }
  });

  it("rejects a malformed month", async () => {
    const leaseId = await leaseIdByTenant("Copperleaf Insurance Agency");
    await api().get(`/api/leases/${leaseId}/statements/2026-10-01`).expect(400);
    await api().get(`/api/leases/${leaseId}/statements/October`).expect(400);
  });
});
