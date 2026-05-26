import { describe, it, expect } from "vitest";
import {
  vietnamMidnightUtc,
  getNextVietnamMidnight,
  getNextVietnamMonthStart,
} from "@/lib/quotaReset";

// Vietnam is UTC+7, no DST.
// vietnamMidnightUtc(y, m, d) returns new Date(Date.UTC(y, m-1, d-1, 17, 0, 0, 0))
// which is the UTC instant that equals 00:00 Vietnam time on that date.

describe("vietnamMidnightUtc", () => {
  it("2026-05-26 00:00 VN = 2026-05-25 17:00 UTC", () => {
    const d = vietnamMidnightUtc(2026, 5, 26);
    expect(d.toISOString()).toBe("2026-05-25T17:00:00.000Z");
  });

  it("2026-01-01 00:00 VN = 2025-12-31 17:00 UTC", () => {
    const d = vietnamMidnightUtc(2026, 1, 1);
    expect(d.toISOString()).toBe("2025-12-31T17:00:00.000Z");
  });

  it("2026-03-01 00:00 VN = 2026-02-28 17:00 UTC (non-leap year)", () => {
    const d = vietnamMidnightUtc(2026, 3, 1);
    expect(d.toISOString()).toBe("2026-02-28T17:00:00.000Z");
  });
});

describe("getNextVietnamMidnight", () => {
  it("returns next midnight when called at noon VN time", () => {
    // 2026-05-26 12:00 VN = 2026-05-26 05:00 UTC
    const noon = new Date("2026-05-26T05:00:00.000Z");
    const next = getNextVietnamMidnight(noon);
    // next midnight = 2026-05-27 00:00 VN = 2026-05-26 17:00 UTC
    expect(next.toISOString()).toBe("2026-05-26T17:00:00.000Z");
  });

  it("returns next midnight when called just after midnight VN", () => {
    // 2026-05-26 00:01 VN = 2026-05-25 17:01 UTC
    const justAfterMidnight = new Date("2026-05-25T17:01:00.000Z");
    const next = getNextVietnamMidnight(justAfterMidnight);
    // next = 2026-05-26 00:00 VN = 2026-05-25 17:00 UTC... wait
    // Actually 00:01 VN is AFTER 00:00 VN, so next midnight = 2026-05-26 17:00 UTC
    expect(next.toISOString()).toBe("2026-05-26T17:00:00.000Z");
  });

  it("midnight rollover at end of month", () => {
    // 2026-05-31 12:00 VN = 2026-05-31 05:00 UTC
    const noon = new Date("2026-05-31T05:00:00.000Z");
    const next = getNextVietnamMidnight(noon);
    // 2026-06-01 00:00 VN = 2026-05-31 17:00 UTC
    expect(next.toISOString()).toBe("2026-05-31T17:00:00.000Z");
  });
});

describe("getNextVietnamMonthStart", () => {
  it("returns first of next month for mid-month input", () => {
    // 2026-05-15 12:00 VN = 2026-05-15 05:00 UTC
    const mid = new Date("2026-05-15T05:00:00.000Z");
    const next = getNextVietnamMonthStart(mid);
    // 2026-06-01 00:00 VN = 2026-05-31 17:00 UTC
    expect(next.toISOString()).toBe("2026-05-31T17:00:00.000Z");
  });

  it("rolls over December to January of next year", () => {
    // 2026-12-15 12:00 VN = 2026-12-15 05:00 UTC
    const dec = new Date("2026-12-15T05:00:00.000Z");
    const next = getNextVietnamMonthStart(dec);
    // 2027-01-01 00:00 VN = 2026-12-31 17:00 UTC
    expect(next.toISOString()).toBe("2026-12-31T17:00:00.000Z");
  });

  it("returns a Date strictly after the input", () => {
    const now = new Date("2026-05-26T05:00:00.000Z");
    const next = getNextVietnamMonthStart(now);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });
});
