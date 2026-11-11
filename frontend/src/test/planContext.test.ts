/**
 * `isTrialActive` — luật ẩn paywall trong thời gian dùng thử (Q1 28/08, thi công Đợt 0 17/09).
 * Hàm thuần, test bảng: đây là chỗ duy nhất quyết định "đang trial hay không" cho toàn web,
 * nên mỗi ca sai ở đây là một nhóm người dùng bị mời nâng cấp nhầm (hoặc không được mời khi cần).
 */
import { describe, it, expect } from "vitest";
import { hasRenewingAiAllowance, isTrialActive, showsRenewingQuotaCopy, type MyPlanDto } from "@/contexts/PlanContext";

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

/**
 * `hasRenewingAiAllowance` — quyết định owner 10/11/2026: gói trả tiền hết ví giữa kỳ vẫn giữ gói,
 * lượt AI hồi lại hôm sau ⇒ thông điệp hết hạn mức nói "ngày mai có lượt mới", không mời nâng cấp.
 */
describe("hasRenewingAiAllowance", () => {
  it.each<[string, MyPlanDto | null | undefined, boolean]>([
    ["plan null", null, false],
    ["plan undefined", undefined, false],
    ["PRO trả tiền còn hạn", { planCode: "PRO", tier: "PRO", isTrial: false, endsAtUtc: "2026-10-01T00:00:00Z" }, true],
    ["PRO không kỳ hạn (endsAtUtc null)", { planCode: "PRO", tier: "PRO", isTrial: false, endsAtUtc: null }, true],
    ["PRO DTO cũ thiếu isTrial/endsAtUtc", { planCode: "PRO", tier: "PRO" }, true],
    ["ULTRA còn hạn", { planCode: "ULTRA", tier: "ULTRA", endsAtUtc: "2026-12-01T00:00:00Z" }, true],
    ["PRO do trung tâm cấp (source ORG) còn hạn", { planCode: "PRO", tier: "PRO", source: "ORG", endsAtUtc: "2026-12-01T00:00:00Z" }, true],
    ["PRO đã hết hạn", { planCode: "PRO", tier: "PRO", isTrial: false, endsAtUtc: "2026-09-10T00:00:00Z" }, false],
    ["PRO hết hạn đúng lúc này (biên)", { planCode: "PRO", tier: "PRO", endsAtUtc: "2026-09-17T10:00:00Z" }, false],
    ["PRO, endsAtUtc không parse được", { planCode: "PRO", tier: "PRO", endsAtUtc: "hôm qua" }, false],
    ["dùng thử còn hạn", { planCode: "PRO", tier: "PRO", isTrial: true, trialEndsAt: "2026-09-24T10:00:00Z", endsAtUtc: "2026-09-24T10:00:00Z" }, true],
    ["dùng thử hết hạn", { planCode: "PRO", tier: "PRO", isTrial: true, trialEndsAt: "2026-09-10T00:00:00Z", endsAtUtc: "2026-09-10T00:00:00Z" }, false],
    ["dùng thử thiếu trialEndsAt dù endsAtUtc tương lai", { planCode: "PRO", tier: "PRO", isTrial: true, trialEndsAt: null, endsAtUtc: "2026-12-01T00:00:00Z" }, false],
    ["FREE", { planCode: "FREE", tier: "DEFAULT", endsAtUtc: "2026-12-01T00:00:00Z" }, false],
    ["DEFAULT", { planCode: "DEFAULT", tier: "DEFAULT", endsAtUtc: null }, false],
    ["INTERNAL (không phải gói ví theo planCode, tier ULTRA) — không bao giờ hết lượt, coi như có", { planCode: "INTERNAL", tier: "ULTRA", endsAtUtc: null }, true],
  ])("%s → %s", (_name, plan, expected) => {
    expect(hasRenewingAiAllowance(plan, NOW)).toBe(expected);
  });
});

describe("showsRenewingQuotaCopy", () => {
  const pro: MyPlanDto = { planCode: "PRO", tier: "PRO", endsAtUtc: "2026-12-01T00:00:00Z" };
  const free: MyPlanDto = { planCode: "DEFAULT", tier: "DEFAULT" };

  it.each<[string, MyPlanDto, string | null | undefined, boolean]>([
    ["PRO + QUOTA_EXCEEDED", pro, "QUOTA_EXCEEDED", true],
    ["PRO + thiếu mã lỗi", pro, undefined, true],
    ["PRO + mã null", pro, null, true],
    ["PRO + ngân sách trung tâm hết → giữ thông điệp cũ", pro, "ORG_BUDGET_EXHAUSTED", false],
    ["PRO + ngân sách trung tâm chưa cấp → giữ thông điệp cũ", pro, "ORG_BUDGET_NOT_CONFIGURED", false],
    ["PRO + vượt tần suất không phải hết ví", pro, "RATE_LIMITED", false],
    ["DEFAULT + QUOTA_EXCEEDED → vẫn mời nâng cấp", free, "QUOTA_EXCEEDED", false],
  ])("%s → %s", (_name, plan, code, expected) => {
    expect(showsRenewingQuotaCopy(plan, code, NOW)).toBe(expected);
  });
});
