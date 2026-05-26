import { describe, it, expect } from "vitest";
import { isAiSpeakingQuotaBlocked } from "@/lib/aiSpeakingQuota";

describe("isAiSpeakingQuotaBlocked", () => {
  it("returns false when quota is null", () => {
    expect(isAiSpeakingQuotaBlocked(null)).toBe(false);
  });

  it("returns false when quota is undefined", () => {
    expect(isAiSpeakingQuotaBlocked(undefined)).toBe(false);
  });

  it("returns false when canStartSession is true and remainingSpendable > 0", () => {
    expect(
      isAiSpeakingQuotaBlocked({ canStartSession: true, remainingSpendable: 5 } as any)
    ).toBe(false);
  });

  it("returns true when canStartSession is false", () => {
    expect(
      isAiSpeakingQuotaBlocked({ canStartSession: false, remainingSpendable: 5 } as any)
    ).toBe(true);
  });

  it("returns true when remainingSpendable is 0", () => {
    expect(
      isAiSpeakingQuotaBlocked({ canStartSession: true, remainingSpendable: 0 } as any)
    ).toBe(true);
  });

  it("returns true when remainingSpendable is negative", () => {
    expect(
      isAiSpeakingQuotaBlocked({ canStartSession: true, remainingSpendable: -1 } as any)
    ).toBe(true);
  });

  it("returns true when both canStartSession is false and remainingSpendable is 0", () => {
    expect(
      isAiSpeakingQuotaBlocked({ canStartSession: false, remainingSpendable: 0 } as any)
    ).toBe(true);
  });
});
