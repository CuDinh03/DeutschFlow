"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AiMessageBubble } from "@/components/speaking/types";

interface Props {
  msg: AiMessageBubble;
  isV2: boolean;
}

/** Collapsible correction/explanation block under an AI turn. Warm paper only —
 *  the speaking surface has no dark variant (parity with the mobile app). */
export function SpeakingFeedbackCompact({ msg, isV2 }: Props) {
  const t = useTranslations("speaking.chat");
  const [open, setOpen] = useState(false);

  const hasCorrection = !!msg.correction;
  const hasExplanation = !isV2 && !!msg.explanationVi;
  const hasGrammar = !!msg.grammarPoint;
  const extraCount = [hasExplanation, hasGrammar].filter(Boolean).length;

  if (!hasCorrection && !hasExplanation && !hasGrammar) return null;

  const primary = msg.correction || msg.explanationVi || msg.grammarPoint || "";

  return (
    <div className="ga-ui rounded-ga border border-ga-line bg-ga-surface overflow-hidden">
      <button
        type="button"
        onClick={() => extraCount > 0 && setOpen((o) => !o)}
        className={`w-full flex items-start gap-2 px-3 py-2.5 text-left ${
          extraCount > 0 ? "cursor-pointer hover:bg-ga-side-active" : "cursor-default"
        }`}
      >
        <span
          className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-ga-pill ${
            hasCorrection
              ? "bg-ga-red text-white"
              : "bg-ga-blue-soft text-ga-blue border border-ga-blue"
          }`}
        >
          {hasCorrection ? t("labelQuickFix") : t("labelExplanationShort")}
        </span>
        <p className="flex-1 text-[13px] leading-relaxed text-ga-ink">{primary}</p>
        {extraCount > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-ga-muted flex-shrink-0 mt-0.5">
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {!open && t("moreFeedback", { n: extraCount })}
          </span>
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-ga-line">
          {hasExplanation && msg.explanationVi && msg.explanationVi !== primary && (
            <p className="text-[12px] leading-relaxed pt-2 text-ga-muted">{msg.explanationVi}</p>
          )}
          {hasGrammar && msg.grammarPoint && (
            <p className="text-[12px] leading-relaxed text-ga-violet">
              <span className="font-semibold">{t("labelGrammarPoint")}: </span>
              {msg.grammarPoint}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
