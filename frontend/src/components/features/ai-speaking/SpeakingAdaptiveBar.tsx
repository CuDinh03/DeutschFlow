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

  const hasFocus =
    (adaptive.focusCodes?.length ?? 0) > 0 ||
    (adaptive.targetStructures?.length ?? 0) > 0 ||
    !!adaptive.topicSuggestion;

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
          {adaptive.cefrEffective && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-ga-pill border"
              style={{ borderColor: accent, background: personaSoft(rawAccent, 0.13), color: accent }}
            >
              {adaptive.cefrEffective}
            </span>
          )}
          {adaptive.focusCodes?.map((code) => (
            <span
              key={code}
              className="text-[10px] font-mono px-2 py-0.5 rounded-ga-pill border"
              style={{ borderColor: personaSoft(rawAccent, 0.35), background: personaSoft(rawAccent, 0.1), color: accent }}
            >
              {code.split(".").pop()}
            </span>
          ))}
          {adaptive.targetStructures?.slice(0, 2).map((s) => (
            <span
              key={s}
              className="text-[10px] px-2 py-0.5 rounded-ga-pill bg-ga-card text-ga-muted border border-ga-line max-w-[200px] truncate"
              title={s}
            >
              {s}
            </span>
          ))}
          {adaptive.topicSuggestion && (
            <span className="text-[11px] text-ga-muted italic truncate max-w-full">
              → {adaptive.topicSuggestion}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
