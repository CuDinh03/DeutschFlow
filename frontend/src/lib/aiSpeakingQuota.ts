import type { AiSpeakingQuota } from "@/lib/aiSpeakingApi";

/** True when backend would reject new AI speaking turns (no spendable quota). */
export function isAiSpeakingQuotaBlocked(
  quota: AiSpeakingQuota | null | undefined,
): boolean {
  if (!quota) return false;
  return !quota.canStartSession || quota.remainingSpendable <= 0;
}
