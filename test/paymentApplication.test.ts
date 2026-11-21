import { describe, expect, it } from "vitest";
import { planApplications } from "../src/services/paymentApplication";

const open = (...amounts: number[]) => amounts.map((open_cents, i) => ({ id: i + 1, open_cents }));

describe("planApplications", () => {
  it("pays invoices off in the order given", () => {
    expect(planApplications(300_00, open(100_00, 100_00, 100_00))).toEqual({
      applications: [
        { invoiceId: 1, amountCents: 100_00 },
        { invoiceId: 2, amountCents: 100_00 },
        { invoiceId: 3, amountCents: 100_00 },
      ],
      unappliedCents: 0,
    });
  });

  it("leaves the last invoice partly paid when the payment runs out", () => {
    expect(planApplications(150_00, open(100_00, 100_00))).toEqual({
      applications: [
        { invoiceId: 1, amountCents: 100_00 },
        { invoiceId: 2, amountCents: 50_00 },
      ],
      unappliedCents: 0,
    });
  });

  it("keeps an overpayment as unapplied credit", () => {
    expect(planApplications(250_00, open(100_00))).toEqual({
      applications: [{ invoiceId: 1, amountCents: 100_00 }],
      unappliedCents: 150_00,
    });
    expect(planApplications(80_00, [])).toEqual({ applications: [], unappliedCents: 80_00 });
  });
});
