"use client";

import { AnimatePresence, motion } from "framer-motion";
import { spring } from "@/lib/motion";
import { X, Mic } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Suggestion, ErrorItem } from "@/lib/aiSpeakingApi";
import type { PhonemeEvalResult } from "@/lib/phonemeApi";
import type { TurnStatus } from "@/lib/speaking/feedbackModel";
import { SpeakingFeedbackSummary } from "./SpeakingFeedbackSummary";

/**
 * Vùng phản hồi ở khổ máy điện thoại (S-07 §Responsive: "feedback trong sheet").
 *
 * Dùng CHUNG `SpeakingFeedbackSummary` với sidebar desktop — trước đây sheet này chép lại một bản
 * rút gọn của cùng ba khối (phoneme · lỗi · gợi ý), nên hai khổ máy nói khác nhau về cùng một lượt:
 * bản mobile lặng lẽ bỏ mất `ruleViShort` và `exampleCorrectDe`, tức người học trên điện thoại
 * thấy mình sai ở đâu nhưng không thấy vì sao.
 */
interface Props {
  open: boolean;
  onClose: () => void;
  showSuggestions: boolean;
  suggestions: Suggestion[];
  analysedErrors: ErrorItem[] | undefined;
  turnStatus: TurnStatus | null;
  turnNote: string | null;
  phonemeResult: PhonemeEvalResult | null;
  phonemeLoading?: boolean;
  onSuggestionSelect: (text: string) => void;
}

export function SpeakingMobileCopilotSheet({
  open,
  onClose,
  showSuggestions,
  suggestions,
  analysedErrors,
  turnStatus,
  turnNote,
  phonemeResult,
  phonemeLoading,
  onSuggestionSelect,
}: Props) {
  const t = useTranslations("speaking.chat");

  const hasContent =
    analysedErrors !== undefined ||
    !!phonemeResult ||
    !!turnStatus ||
    (showSuggestions && suggestions.length > 0);

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

            <div className="p-4 pb-8">
              <SpeakingFeedbackSummary
                analysedErrors={analysedErrors}
                suggestions={suggestions}
                suggestionsVisible={showSuggestions}
                phonemeResult={phonemeResult}
                turnStatus={turnStatus}
                turnNote={turnNote}
                phonemeLoading={phonemeLoading}
                onSuggestionSelect={(text) => {
                  onSuggestionSelect(text);
                  onClose();
                }}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
