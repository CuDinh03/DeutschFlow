/**
 * `isTrialActive` — luật ẩn paywall trong thời gian dùng thử (Q1 28/08, thi công Đợt 0 17/09).
 * Hàm thuần, test bảng: đây là chỗ duy nhất quyết định "đang trial hay không" cho toàn web,
 * nên mỗi ca sai ở đây là một nhóm người dùng bị mời nâng cấp nhầm (hoặc không được mời khi cần).
 */
import { describe, it, expect } from "vitest";
import { isTrialActive, type MyPlanDto } from "@/contexts/PlanContext";

const NOW = Date.parse("2026-09-17T10:00:00Z");
const base: MyPlanDto = { planCode: "PRO", tier: "PREMIUM" };

describe("isTrialActive", () => {
  it.each<[string, MyPlanDto | null | undefined, boolean]>([
    ["plan null", null, false],
    ["plan undefined", undefined, false],
    ["không có isTrial (client cũ / DTO cũ)", { ...base }, false],
    ["isTrial=false dù trialEndsAt tương lai", { ...base, isTrial: false, trialEndsAt: "2026-10-01T00:00:00Z" }, false],
    ["isTrial=true nhưng trialEndsAt null", { ...base, isTrial: true, trialEndsAt: null }, false],
    ["isTrial=true, trialEndsAt quá khứ", { ...base, isTrial: true, trialEndsAt: "2026-09-10T00:00:00Z" }, false],
    ["isTrial=true, trialEndsAt đúng lúc này (hết hạn tại biên)", { ...base, isTrial: true, trialEndsAt: "2026-09-17T10:00:00Z" }, false],
    ["isTrial=true, trialEndsAt tương lai", { ...base, isTrial: true, trialEndsAt: "2026-09-24T10:00:00Z" }, true],
    ["isTrial=true, trialEndsAt không parse được", { ...base, isTrial: true, trialEndsAt: "hôm qua" }, false],
    ["PRO trả tiền (isTrial=false) KHÔNG phải trial — không được ẩn paywall gia hạn", { planCode: "PRO", tier: "PREMIUM", isTrial: false, trialEndsAt: null, source: "IAP" }, false],
  ])("%s → %s", (_name, plan, expected) => {
    expect(isTrialActive(plan, NOW)).toBe(expected);
  });
});
