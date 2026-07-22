"use client";

import { AnimatePresence, motion } from "framer-motion";
import { spring } from "@/lib/motion";
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
            className="fixed inset-0 z-40 md:hidden"
            style={{ background: "rgba(22, 21, 19, 0.45)" }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={spring.nav}
            className="ga-ui fixed bottom-0 left-0 right-0 z-50 md:hidden max-h-[70vh] overflow-y-auto rounded-t-[16px] bg-ga-card border-t border-ga-line shadow-ga-panel"
          >
            <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-ga-line bg-ga-card">
              <span className="text-sm font-semibold text-ga-ink flex items-center gap-2">
                <Mic size={14} className="text-ga-accent" />
                {t("mobileCopilotTitle")}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full hover:bg-ga-side-active text-ga-muted"
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
                <div className="rounded-ga p-4 border border-ga-red bg-ga-red-soft">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={14} className="text-ga-red" />
                    <span className="text-[10px] font-bold text-ga-red uppercase">
                      {t("correctionsTitle")}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {lastUserErrors.map((err, idx) => (
                      <li
                        key={`${err.errorCode}-${idx}`}
                        className="text-sm bg-ga-card rounded-ga p-2.5 border border-ga-line"
                      >
                        {err.wrongSpan && (
                          <p className="text-ga-red line-through text-[13px]">
                            &quot;{err.wrongSpan}&quot;
                          </p>
                        )}
                        {err.correctedSpan && (
                          <p className="text-ga-green font-medium text-[13px]">
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
                    <Lightbulb size={13} className="text-ga-gold" />
                    <span className="text-[10px] font-bold text-ga-gold uppercase">
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
                      className="w-full text-left p-3 rounded-ga bg-ga-surface border border-ga-line hover:border-ga-accent transition-colors"
                    >
                      <p className="text-sm font-medium text-ga-ink">
                        {s.german_text}
                      </p>
                      {s.vietnamese_translation && (
                        <p className="text-[12px] text-ga-muted mt-1 italic">
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
