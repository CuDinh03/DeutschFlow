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
      className="ga-ui md:hidden w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-ga-card border-t border-ga-line text-left"
    >
      <div className="flex items-center gap-2 min-w-0">
        {errorCount > 0 ? (
          <AlertCircle size={16} className="text-ga-red flex-shrink-0" />
        ) : phonemeScore != null ? (
          <Mic size={16} className="text-ga-blue flex-shrink-0" />
        ) : (
          <Lightbulb size={16} className="text-ga-gold flex-shrink-0" />
        )}
        <span className="text-xs text-ga-muted truncate">{parts.join(" · ")}</span>
      </div>
      <span className="text-[11px] font-semibold text-ga-accent flex items-center gap-0.5 flex-shrink-0">
        {t("stripView")}
        <ChevronRight size={14} />
      </span>
    </button>
  );
}
