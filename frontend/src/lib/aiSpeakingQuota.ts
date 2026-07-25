import type { AiSpeakingQuota } from "@/lib/aiSpeakingApi";

/** True when backend would reject new AI speaking turns (no spendable quota). */
export function isAiSpeakingQuotaBlocked(
  quota: AiSpeakingQuota | null | undefined,
): boolean {
  if (!quota) return false;
  return !quota.canStartSession || quota.remainingSpendable <= 0;
}

/**
 * Ngưỡng coi là "không giới hạn" (audit 24/07 R-W6). Backend trả sentinel 999_999_999 cho gói
 * INTERNAL (QuotaService) — không được in số thô "999999999" ra badge. Không user thật nào có tới
 * 100 triệu token khả dụng, nên mọi giá trị ≥ ngưỡng này là unlimited.
 */
export const UNLIMITED_QUOTA_THRESHOLD = 100_000_000;

/** True khi số dư là sentinel unlimited (gói nội bộ) — badge nên ẩn thay vì in số khổng lồ. */
export function isUnlimitedAiSpeakingQuota(
  quota: AiSpeakingQuota | null | undefined,
): boolean {
  return !!quota && quota.remainingSpendable >= UNLIMITED_QUOTA_THRESHOLD;
}
