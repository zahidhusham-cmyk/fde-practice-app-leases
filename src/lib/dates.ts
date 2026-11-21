// Date helpers. Dates travel through the app as 'YYYY-MM-DD' strings (see the DATE
// type parser in db/pool.ts), and billing months as 'YYYY-MM' strings. When we need
// date arithmetic we go through UTC midnight so the local timezone can't shift a day.

import { ValidationError } from "./errors";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Add (or subtract) whole days: addDays("2026-02-28", 1) -> "2026-03-01". */
export function addDays(date: string, days: number): string {
  return fromUtc(new Date(toUtc(date).getTime() + days * MS_PER_DAY));
}

/** Whole days from `from` to `to`: daysBetween("2026-03-01", "2026-03-04") -> 3. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / MS_PER_DAY);
}

/** Number of days in a calendar month. `month` is 1-12. */
export function daysInMonth(year: number, month: number): number {
  // Day 0 of a month is the last day of the month before it.
  return new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
}

export interface BillingMonth {
  /** "2026-03" */
  label: string;
  year: number;
  /** 1-12 */
  month: number;
  /** First day of the month, inclusive: "2026-03-01" */
  start: string;
  /** Last day of the month, inclusive: "2026-03-31" */
  end: string;
}

/** Parse "YYYY-MM" into the month's first and last day. Throws ValidationError if malformed. */
export function parseMonth(value: unknown, name = "month"): BillingMonth {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) {
    throw new ValidationError(`${name} must look like 2026-03`);
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  if (month < 1 || month > 12) {
    throw new ValidationError(`${name} must have a month between 01 and 12`);
  }
  const start = `${value}-01`;
  const nextMonthStart =
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return { label: value, year, month, start, end: addDays(nextMonthStart, -1) };
}

/** "2026-03" -> "March 2026" */
export function monthName(m: BillingMonth): string {
  return toUtc(m.start).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Today's date in the server's local timezone, as YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
