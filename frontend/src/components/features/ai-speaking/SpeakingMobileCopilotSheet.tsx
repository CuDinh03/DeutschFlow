"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X, Lightbulb, AlertCircle, Mic } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Suggestion, ErrorItem } from "@/lib/aiSpeakingApi";
import type { PhonemeEvalResult } from "@/lib/phonemeApi";
import { SpeakingPhonemePanel } from "./SpeakingPhonemePanel";

interface Props {
  open: boolean;
  onClose: () => void;
  showSuggestions: boolean;
  suggestions: Suggestion[];
  lastUserErrors: ErrorItem[];
  phonemeResult: PhonemeEvalResult | null;
  phonemeLoading?: boolean;
  onSuggestionSelect: (text: string) => void;
}

export function SpeakingMobileCopilotSheet({
  open,
  onClose,
  showSuggestions,
  suggestions,
  lastUserErrors,
  phonemeResult,
  phonemeLoading,
  onSuggestionSelect,
}: Props) {
  const t = useTranslations("speaking.chat");

  const hasContent =
    (showSuggestions && suggestions.length > 0) ||
    lastUserErrors.length > 0 ||
    !!phonemeResult ||
    phonemeLoading;

  return (
    <AnimatePresence>
      {open && hasContent && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-50 md:hidden max-h-[70vh] overflow-y-auto rounded-t-3xl bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl"
          >
            <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Mic size={14} className="text-cyan-500" />
                {t("mobileCopilotTitle")}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                aria-label={t("mobileCopilotClose")}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4 pb-8">
              {phonemeResult && (
                <SpeakingPhonemePanel result={phonemeResult} loading={phonemeLoading} />
              )}

              {lastUserErrors.length > 0 && (
                <div className="rounded-2xl p-4 border border-red-200 dark:border-red-800 bg-red-50/80 dark:bg-red-950/25">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={14} className="text-red-500" />
                    <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase">
                      {t("correctionsTitle")}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {lastUserErrors.map((err, idx) => (
                      <li
                        key={`${err.errorCode}-${idx}`}
                        className="text-sm bg-white dark:bg-slate-800 rounded-lg p-2.5 border border-red-100 dark:border-red-900/40"
                      >
                        {err.wrongSpan && (
                          <p className="text-red-500 line-through text-[13px]">
                            &quot;{err.wrongSpan}&quot;
                          </p>
                        )}
                        {err.correctedSpan && (
                          <p className="text-emerald-700 dark:text-emerald-400 font-medium text-[13px]">
                            → &quot;{err.correctedSpan}&quot;
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {showSuggestions && suggestions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Lightbulb size={13} className="text-amber-500" />
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                      {t("suggestionsTitle")}
                    </span>
                  </div>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        onSuggestionSelect(s.german_text);
                        onClose();
                      }}
                      className="w-full text-left p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    >
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {s.german_text}
                      </p>
                      {s.vietnamese_translation && (
                        <p className="text-[12px] text-slate-500 mt-1 italic">
                          {s.vietnamese_translation}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
