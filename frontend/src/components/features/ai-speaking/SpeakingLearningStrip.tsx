"use client";

import { AlertCircle, Lightbulb, Mic, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

interface Props {
  errorCount: number;
  phonemeScore?: number | null;
  suggestionCount: number;
  onOpen: () => void;
}

export function SpeakingLearningStrip({
  errorCount,
  phonemeScore,
  suggestionCount,
  onOpen,
}: Props) {
  const t = useTranslations("speaking.chat");

  if (errorCount === 0 && phonemeScore == null && suggestionCount === 0) return null;

  const parts: string[] = [];
  if (errorCount > 0) parts.push(t("stripErrors", { n: errorCount }));
  if (phonemeScore != null) parts.push(t("stripPhoneme", { score: Math.round(phonemeScore) }));
  if (suggestionCount > 0) parts.push(t("stripSuggestions", { n: suggestionCount }));

  return (
    <button
      type="button"
      onClick={onOpen}
      className="md:hidden w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-[rgba(10,22,40,0.9)] border-t border-cyan-500/20 text-left"
    >
      <div className="flex items-center gap-2 min-w-0">
        {errorCount > 0 ? (
          <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
        ) : phonemeScore != null ? (
          <Mic size={16} className="text-cyan-400 flex-shrink-0" />
        ) : (
          <Lightbulb size={16} className="text-amber-400 flex-shrink-0" />
        )}
        <span className="text-xs text-white/75 truncate">{parts.join(" · ")}</span>
      </div>
      <span className="text-[11px] font-semibold text-cyan-400 flex items-center gap-0.5 flex-shrink-0">
        {t("stripView")}
        <ChevronRight size={14} />
      </span>
    </button>
  );
}
