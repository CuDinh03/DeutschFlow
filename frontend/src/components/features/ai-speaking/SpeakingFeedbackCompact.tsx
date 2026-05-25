"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AiMessageBubble } from "@/components/speaking/types";

interface Props {
  msg: AiMessageBubble;
  isV2: boolean;
  dark: boolean;
}

export function SpeakingFeedbackCompact({ msg, isV2, dark }: Props) {
  const t = useTranslations("speaking.chat");
  const [open, setOpen] = useState(false);

  const hasCorrection = !!msg.correction;
  const hasExplanation = !isV2 && !!msg.explanationVi;
  const hasGrammar = !!msg.grammarPoint;
  const extraCount = [hasExplanation, hasGrammar].filter(Boolean).length;

  if (!hasCorrection && !hasExplanation && !hasGrammar) return null;

  const primary = msg.correction || msg.explanationVi || msg.grammarPoint || "";

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        dark ? "border-white/12 bg-white/[0.04]" : "border-slate-200 bg-slate-50/90"
      }`}
    >
      <button
        type="button"
        onClick={() => extraCount > 0 && setOpen((o) => !o)}
        className={`w-full flex items-start gap-2 px-3 py-2.5 text-left ${
          extraCount > 0 ? "cursor-pointer hover:bg-white/5" : "cursor-default"
        }`}
      >
        <span
          className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
            hasCorrection
              ? "bg-red-600/90 text-white"
              : dark
                ? "bg-cyan-900/60 text-cyan-100 border border-cyan-400/30"
                : "bg-cyan-100 text-cyan-900"
          }`}
        >
          {hasCorrection ? t("labelQuickFix") : t("labelExplanationShort")}
        </span>
        <p
          className={`flex-1 text-[13px] leading-relaxed ${
            dark ? "text-white/85" : "text-slate-800"
          }`}
        >
          {primary}
        </p>
        {extraCount > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-white/50 flex-shrink-0 mt-0.5">
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {!open && t("moreFeedback", { n: extraCount })}
          </span>
        )}
      </button>

      {open && (
        <div className={`px-3 pb-3 space-y-2 border-t ${dark ? "border-white/10" : "border-slate-200"}`}>
          {hasExplanation && msg.explanationVi && msg.explanationVi !== primary && (
            <p className={`text-[12px] leading-relaxed pt-2 ${dark ? "text-white/65" : "text-slate-600"}`}>
              {msg.explanationVi}
            </p>
          )}
          {hasGrammar && msg.grammarPoint && (
            <p className={`text-[12px] leading-relaxed ${dark ? "text-violet-200/80" : "text-violet-800"}`}>
              <span className="font-semibold">{t("labelGrammarPoint")}: </span>
              {msg.grammarPoint}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
