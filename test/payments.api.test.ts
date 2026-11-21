import { describe, expect, it } from "vitest";
import { api, leaseIdByTenant, useFreshDatabase } from "./helpers";

useFreshDatabase();

// Copperleaf stopped paying after August: September, October and November are open (8,600.00 each).
const COPPERLEAF = "Copperleaf Insurance Agency";

type Invoice = { due_date: string; open_cents: number; paid_cents: number };
const byDue = (invoices: Invoice[], due: string) => invoices.find((i) => i.due_date === due)!;

describe("POST /api/leases/:leaseId/payments", () => {
  it("applies a payment to the oldest open invoice first", async () => {
    const leaseId = await leaseIdByTenant(COPPERLEAF);
    const res = await api()
      .post(`/api/leases/${leaseId}/payments`)
      .send({ received_on: "2026-11-20", amount_cents: 8_600_00, reference: "Wire 5521" })
      .expect(201);

    expect(res.body).toMatchObject({
      lease_id: leaseId,
      received_on: "2026-11-20",
      amount_cents: 8_600_00,
      reference: "Wire 5521",
      applied_cents: 8_600_00,
      unapplied_cents: 0,
    });
    expect(res.body.applications).toHaveLength(1);
    expect(res.body.applications[0].invoice_description).toBe("Rent, September 2026");

    const lease = await api().get(`/api/leases/${leaseId}`).expect(200);
    expect(byDue(lease.body.invoices, "2026-09-01").open_cents).toBe(0);
    expect(byDue(lease.body.invoices, "2026-10-01").open_cents).toBe(8_600_00);
    expect(byDue(lease.body.invoices, "2026-11-01").open_cents).toBe(8_600_00);
  });

  it("spreads a larger payment across invoices, oldest first", async () => {
    const leaseId = await leaseIdByTenant(COPPERLEAF);
    await api()
      .post(`/api/leases/${leaseId}/payments`)
      .send({ received_on: "2026-11-20", amount_cents: 12_900_00 })
      .expect(201);

    const lease = await api().get(`/api/leases/${leaseId}`).expect(200);
    expect(byDue(lease.body.invoices, "2026-09-01").open_cents).toBe(0);
    expect(byDue(lease.body.invoices, "2026-10-01").open_cents).toBe(4_300_00);
    expect(byDue(lease.body.invoices, "2026-11-01").open_cents).toBe(8_600_00);
    expect(lease.body.totals.balance_cents).toBe(12_900_00);
  });

  it("keeps an overpayment as unapplied credit", async () => {
    const leaseId = await leaseIdByTenant("Tidewater Coffee Co."); // fully paid up
    const res = await api()
      .post(`/api/leases/${leaseId}/payments`)
      .send({ received_on: "2026-11-20", amount_cents: 1_000_00 })
      .expect(201);
    expect(res.body).toMatchObject({ applied_cents: 0, unapplied_cents: 1_000_00, applications: [] });

    const lease = await api().get(`/api/leases/${leaseId}`).expect(200);
    expect(lease.body.totals.balance_cents).toBe(-1_000_00);
    expect(lease.body.totals.unapplied_credit_cents).toBe(1_000_00);
  });

  it("shows up in the payment list and on the rent roll", async () => {
    const leaseId = await leaseIdByTenant(COPPERLEAF);
    await api()
      .post(`/api/leases/${leaseId}/payments`)
      .send({ received_on: "2026-11-20", amount_cents: 500_00 })
      .expect(201);

    const lease = await api().get(`/api/leases/${leaseId}`).expect(200);
    expect(lease.body.payments[0]).toMatchObject({ received_on: "2026-11-20", amount_cents: 500_00 });

    const roll = await api().get(`/api/properties/${lease.body.lease.property_id}?as_of=2026-11-21`).expect(200);
    const unit = roll.body.units.find((u: { lease: { id: number } | null }) => u.lease?.id === leaseId);
    expect(unit.lease.balance_cents).toBe(25_800_00 - 500_00);
  });

  it("returns 404 for an unknown lease", async () => {
    const res = await api()
      .post("/api/leases/9999/payments")
      .send({ received_on: "2026-11-20", amount_cents: 100_00 })
      .expect(404);
    expect(res.body.error).toMatch(/Lease 9999/);
  });

  it("rejects amounts that aren't a positive whole number of cents", async () => {
    const leaseId = await leaseIdByTenant(COPPERLEAF);
    for (const amount_cents of [0, -500, 12.5, "100", null]) {
      await api()
        .post(`/api/leases/${leaseId}/payments`)
        .send({ received_on: "2026-11-20", amount_cents })
        .expect(400);
    }
  });

  it("rejects dates that aren't real YYYY-MM-DD dates", async () => {
    const leaseId = await leaseIdByTenant(COPPERLEAF);
    for (const received_on of ["2026-02-30", "11/20/2026", undefined]) {
      await api()
        .post(`/api/leases/${leaseId}/payments`)
        .send({ received_on, amount_cents: 100_00 })
        .expect(400);
    }
  });
});
