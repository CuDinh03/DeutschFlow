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
      className="rounded-2xl p-4 border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/25"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-300 uppercase tracking-wide">
          {t("phonemeTitle")}
        </span>
        <span
          className="text-lg font-bold tabular-nums"
          style={{
            color: result.score >= 70 ? "#059669" : result.score >= 50 ? "#D97706" : "#DC2626",
          }}
        >
          {loading ? "…" : `${result.score}%`}
        </span>
      </div>
      {result.feedbackVi && (
        <p className="text-[12px] text-slate-600 dark:text-slate-400 mb-2 leading-relaxed">
          {result.feedbackVi}
        </p>
      )}
      {weakWords.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {weakWords.map((w) => (
            <span
              key={w.word}
              className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
              title={`${Math.round(w.similarity * 100)}%`}
            >
              {w.word}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-emerald-700 dark:text-emerald-400 font-medium">{t("phonemeAllGood")}</p>
      )}
    </motion.div>
  );
}
