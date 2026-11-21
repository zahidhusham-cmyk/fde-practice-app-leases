import { describe, expect, it } from "vitest";
import { parseMonth } from "../src/lib/dates";
import { rentForMonth } from "../src/services/proration";

const lease = (startDate: string, endDate: string, monthlyRentCents: number) => ({
  startDate,
  endDate,
  monthlyRentCents,
});

describe("rentForMonth", () => {
  it("charges the full monthly rent when the lease covers the whole month", () => {
    const charge = rentForMonth(lease("2024-03-01", "2029-02-28", 4_850_00), parseMonth("2026-06"));
    expect(charge).toEqual({ amountCents: 4_850_00, daysBilled: 30, prorated: false });
  });

  it("returns null for a month the lease doesn't touch", () => {
    expect(rentForMonth(lease("2026-09-01", "2031-08-31", 5_600_00), parseMonth("2026-08"))).toBeNull();
    expect(rentForMonth(lease("2021-01-01", "2026-06-15", 5_100_00), parseMonth("2026-07"))).toBeNull();
  });

  it("prorates an August move-in by the days occupied", () => {
    // Aug 11-31 is 21 of August's 31 days: 7,250.00 x 21 / 31 = 4,911.29
    const charge = rentForMonth(lease("2026-08-11", "2029-08-31", 7_250_00), parseMonth("2026-08"));
    expect(charge).toEqual({ amountCents: 4_911_29, daysBilled: 21, prorated: true });
  });

  it("prorates a January move-out by the days occupied", () => {
    // Jan 1-10 is 10 of January's 31 days: 3,100.00 x 10 / 31 = 1,000.00
    const charge = rentForMonth(lease("2024-01-01", "2026-01-10", 3_100_00), parseMonth("2026-01"));
    expect(charge).toEqual({ amountCents: 1_000_00, daysBilled: 10, prorated: true });
  });

  it("counts both the first and the last day of a lease", () => {
    const charge = rentForMonth(lease("2026-08-10", "2026-08-20", 3_100_00), parseMonth("2026-08"));
    expect(charge?.daysBilled).toBe(11);
    expect(charge?.amountCents).toBe(1_100_00);
  });

  it("prorates a mid-month move-in by the number of days in that month", () => {
    // Apr 16-30 is 15 of April's 30 days, so exactly half the rent.
    const charge = rentForMonth(lease("2026-04-16", "2031-04-30", 6_000_00), parseMonth("2026-04"));
    expect(charge).toEqual({ amountCents: 3_000_00, daysBilled: 15, prorated: true });
  });
});
