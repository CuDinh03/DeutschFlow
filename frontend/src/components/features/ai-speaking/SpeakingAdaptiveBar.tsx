"use client";

import { Target } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AdaptiveMeta } from "@/lib/aiSpeakingApi";
import { getPersonaV2VisualTokens, normalizeSpeakingPersona } from "@/components/speaking/personaTheme";
import { personaInk, personaSoft } from "@/lib/personaPaper";

interface Props {
  adaptive: AdaptiveMeta | null;
  repairBlocking?: boolean;
  personaId?: string | null;
}

export function SpeakingAdaptiveBar({ adaptive, repairBlocking, personaId }: Props) {
  const t = useTranslations("speaking");

  if (!adaptive?.enabled) return null;

  // QA 09/08 (lần rò thứ 2 của component này): cefrEffective (C1/C2) + targetStructures là cơ chế
  // nội bộ — nay đã bị CẮT từ AdaptiveMetaDto, dải chỉ còn phần dành cho người học:
  // banner sửa lỗi + chủ đề của PHIÊN (trước đây lấy nhầm kế hoạch trong ngày → "→ Sport" lạc đề).
  const hasFocus = !!adaptive.topicSuggestion;

  if (!hasFocus && !repairBlocking) return null;

  const rawAccent = getPersonaV2VisualTokens(normalizeSpeakingPersona(personaId ?? undefined)).accent;
  // On paper the persona hue only carries text once darkened to AA (lib/personaPaper).
  const accent = personaInk(rawAccent);

  return (
    <div
      className="ga-ui px-4 py-2 border-b border-ga-line"
      style={{ background: `linear-gradient(90deg, ${personaSoft(rawAccent, 0.08)}, transparent)` }}
    >
      {repairBlocking && (
        <p className="text-xs font-semibold text-ga-gold mb-2">{t("forceRepairBanner")}</p>
      )}
      {hasFocus && (
        <div className="flex items-start gap-2 flex-wrap">
          <Target size={14} className="flex-shrink-0 mt-0.5" style={{ color: accent }} />
          <span className="text-[11px] text-ga-muted italic truncate max-w-full">
            → {adaptive.topicSuggestion}
          </span>
        </div>
      )}
    </div>
  );
}
