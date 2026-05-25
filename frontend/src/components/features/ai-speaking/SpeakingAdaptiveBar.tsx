"use client";

import { Target } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AdaptiveMeta } from "@/lib/aiSpeakingApi";
import { getPersonaV2VisualTokens, normalizeSpeakingPersona } from "@/components/speaking/personaTheme";

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

  const accent = getPersonaV2VisualTokens(normalizeSpeakingPersona(personaId ?? undefined)).accent;

  return (
    <div
      className="px-4 py-2 border-b border-white/10"
      style={{ background: `linear-gradient(90deg, ${accent}12, transparent)` }}
    >
      {repairBlocking && (
        <p className="text-xs font-semibold text-amber-200/90 mb-2">{t("forceRepairBanner")}</p>
      )}
      {hasFocus && (
        <div className="flex items-start gap-2 flex-wrap">
          <Target size={14} className="flex-shrink-0 mt-0.5" style={{ color: accent }} />
          {adaptive.cefrEffective && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full border text-white/90"
              style={{ borderColor: `${accent}55`, background: `${accent}22` }}
            >
              {adaptive.cefrEffective}
            </span>
          )}
          {adaptive.focusCodes?.map((code) => (
            <span
              key={code}
              className="text-[10px] font-mono px-2 py-0.5 rounded-full border text-white/80"
              style={{ borderColor: `${accent}40`, background: `${accent}18` }}
            >
              {code.split(".").pop()}
            </span>
          ))}
          {adaptive.targetStructures?.slice(0, 2).map((s) => (
            <span
              key={s}
              className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/55 border border-white/10 max-w-[200px] truncate"
              title={s}
            >
              {s}
            </span>
          ))}
          {adaptive.topicSuggestion && (
            <span className="text-[11px] text-white/45 italic truncate max-w-full">
              → {adaptive.topicSuggestion}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
