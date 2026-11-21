import { daysBetween, daysInMonth, type BillingMonth } from "../lib/dates";

export interface LeaseTerms {
  startDate: string; // inclusive
  endDate: string; // inclusive
  monthlyRentCents: number;
}

export interface MonthlyCharge {
  amountCents: number;
  /** Days of the month the tenant occupies the unit. */
  daysBilled: number;
  /** True when the lease covers only part of the month. */
  prorated: boolean;
}

/**
 * Rent owed for one calendar month.
 *
 * A lease that covers the whole month pays the full monthly rent. A lease that starts or
 * ends part-way through the month (move-in / move-out) pays for the days it occupies:
 * monthly rent x days occupied / days in that month, rounded to the nearest cent.
 * Returns null if the lease doesn't touch the month at all.
 */
export function rentForMonth(lease: LeaseTerms, month: BillingMonth): MonthlyCharge | null {
  if (lease.endDate < month.start || lease.startDate > month.end) return null;

  const from = lease.startDate > month.start ? lease.startDate : month.start;
  const to = lease.endDate < month.end ? lease.endDate : month.end;
  const daysBilled = daysBetween(from, to) + 1;

  if (from === month.start && to === month.end) {
    return { amountCents: lease.monthlyRentCents, daysBilled, prorated: false };
  }

  const totalDays = daysInMonth(month.year, month.month);
  const amountCents = Math.round((lease.monthlyRentCents * daysBilled) / totalDays);
  return { amountCents, daysBilled, prorated: true };
}
