"use client";

import { useTranslations } from "next-intl";
import type { AiSpeakingQuota } from "@/lib/aiSpeakingApi";
import { shouldShowAiSpeakingQuota } from "@/lib/authSession";

interface Props {
  quota: AiSpeakingQuota | null;
}

export function SpeakingQuotaPill({ quota }: Props) {
  const t = useTranslations("speaking.chat");

  if (!shouldShowAiSpeakingQuota()) return null;
  if (!quota) return null;

  const low = quota.remainingSpendable <= 0 || !quota.canStartSession;

  return (
    <div
      className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border ${
        low
          ? "bg-red-500/15 text-red-300 border-red-400/30"
          : "bg-white/8 text-white/55 border-white/12"
      }`}
      title={t("quotaHint")}
    >
      <span>{t("quotaRemaining", { n: Math.max(0, Math.round(quota.remainingSpendable)) })}</span>
    </div>
  );
}
