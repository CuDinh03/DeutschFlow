"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { PhonemeEvalResult } from "@/lib/phonemeApi";

interface Props {
  result: PhonemeEvalResult;
  loading?: boolean;
}

export function SpeakingPhonemePanel({ result, loading }: Props) {
  const t = useTranslations("speaking.chat");

  const weakWords = result.words?.filter((w) => !w.correct) ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="ga-ui rounded-ga p-4 border border-ga-blue bg-ga-blue-soft"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] font-bold text-ga-blue uppercase tracking-[0.08em]">
          {t("phonemeTitle")}
        </span>
        <span
          className="text-lg font-bold tabular-nums"
          style={{
            color: result.score >= 70 ? "var(--ga-green)" : result.score >= 50 ? "var(--ga-gold)" : "var(--ga-red)",
          }}
        >
          {loading ? "…" : `${result.score}%`}
        </span>
      </div>
      {result.feedbackVi && (
        <p className="text-[12px] text-ga-muted mb-2 leading-relaxed">
          {result.feedbackVi}
        </p>
      )}
      {weakWords.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {weakWords.map((w) => (
            <span
              key={w.word}
              className="text-[11px] font-semibold px-2 py-1 rounded-ga bg-ga-red-soft text-ga-red border border-ga-red"
              title={`${Math.round(w.similarity * 100)}%`}
            >
              {w.word}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-ga-green font-medium">{t("phonemeAllGood")}</p>
      )}
    </motion.div>
  );
}
