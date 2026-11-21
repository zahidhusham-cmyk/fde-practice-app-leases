import { describe, expect, it } from "vitest";
import { addDays, daysBetween, parseMonth, todayIso } from "../src/lib/dates";

describe("parseMonth", () => {
  it("returns the first and last day of the month", () => {
    expect(parseMonth("2026-04")).toMatchObject({ year: 2026, month: 4, start: "2026-04-01", end: "2026-04-30" });
    expect(parseMonth("2026-02")).toMatchObject({ start: "2026-02-01", end: "2026-02-28" });
    expect(parseMonth("2028-02").end).toBe("2028-02-29");
  });

  it("handles December rolling into the next year", () => {
    expect(parseMonth("2026-12")).toMatchObject({ start: "2026-12-01", end: "2026-12-31" });
  });

  it("rejects malformed months", () => {
    for (const bad of ["2026-13", "2026-00", "2026-3", "March", 202603, undefined]) {
      expect(() => parseMonth(bad)).toThrow();
    }
  });
});

describe("day arithmetic", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("counts whole days between dates", () => {
    expect(daysBetween("2026-03-01", "2026-03-04")).toBe(3);
    expect(daysBetween("2026-03-01", "2026-03-01")).toBe(0);
    // Across the US daylight-saving change (Mar 8, 2026) it's still a whole number.
    expect(daysBetween("2026-03-01", "2026-04-01")).toBe(31);
  });

  it("formats today's date as YYYY-MM-DD", () => {
    expect(todayIso(new Date(2026, 10, 21, 9, 30))).toBe("2026-11-21");
  });
});
