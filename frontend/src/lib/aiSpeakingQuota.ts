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

/** Backend phát sentinel này khi pool trung tâm không giới hạn (cùng quy ước INTERNAL). */
const ORG_BUDGET_UNLIMITED_SENTINEL = 999_999_999;

/**
 * True khi gói/pool là loại không giới hạn — badge nên ẩn thay vì in số dư khổng lồ.
 * Nhánh sentinel CHỈ xét khi {@code orgBudget} (2 kênh token 26/07: số là pool trung tâm, không
 * bao giờ là ví trả phí) — mối lo gốc của R-W6 (ví ULTRA lớn bị ẩn nhầm) không áp ở nhánh này.
 */
export function isUnlimitedAiSpeakingQuota(
  quota: AiSpeakingQuota | null | undefined,
): boolean {
  if (!quota) return false;
  if (quota.planCode === UNLIMITED_PLAN_CODE) return true;
  return !!quota.orgBudget && quota.remainingSpendable >= ORG_BUDGET_UNLIMITED_SENTINEL;
}
