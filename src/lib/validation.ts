import { ValidationError } from "./errors";

export function parseId(value: unknown, name: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ValidationError(`${name} must be a positive integer`);
  }
  return n;
}

/** Money arrives from the API as integer cents. */
export function parseAmountCents(value: unknown, name = "amount_cents"): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new ValidationError(`${name} must be a positive integer number of cents`);
  }
  return value;
}

/** A calendar date in YYYY-MM-DD form that actually exists (no 2026-02-30). */
export function parseDate(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError(`${name} must be a date in YYYY-MM-DD form`);
  }
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new ValidationError(`${name} is not a real calendar date`);
  }
  return value;
}

export function parseOptionalText(value: unknown, name: string, maxLength = 200): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new ValidationError(`${name} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ValidationError(`${name} must be at most ${maxLength} characters`);
  }
  return trimmed;
}
