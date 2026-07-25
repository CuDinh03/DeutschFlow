import type { AiSpeakingQuota } from "@/lib/aiSpeakingApi";

/** True when backend would reject new AI speaking turns (no spendable quota). */
export function isAiSpeakingQuotaBlocked(
  quota: AiSpeakingQuota | null | undefined,
): boolean {
  if (!quota) return false;
  return !quota.canStartSession || quota.remainingSpendable <= 0;
}

/**
 * Mã gói "không giới hạn" (audit 24/07 R-W6). Backend (`QuotaService`) chỉ gán số dư sentinel
 * 999_999_999 cho đúng gói này, và badge không được in số thô đó ra.
 *
 * Dùng {@code planCode} làm NGUỒN CHÂN LÝ thay vì so số dư với một ngưỡng: gói trả phí có
 * {@code walletCap = dailyGrant × walletCapDays} có thể lớn tuỳ cấu hình (ví dụ ULTRA từng là
 * 2_000_000 × 90 = 180M ở V73 trước khi bị hạ) — so ngưỡng sẽ ẩn nhầm badge của người trả phí.
 */
const UNLIMITED_PLAN_CODE = "INTERNAL";

/** True khi gói là loại không giới hạn (nội bộ) — badge nên ẩn thay vì in số dư khổng lồ. */
export function isUnlimitedAiSpeakingQuota(
  quota: AiSpeakingQuota | null | undefined,
): boolean {
  return !!quota && quota.planCode === UNLIMITED_PLAN_CODE;
}
