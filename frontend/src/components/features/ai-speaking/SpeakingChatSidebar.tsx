"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { Suggestion, ErrorItem } from "@/lib/aiSpeakingApi";
import type { PhonemeEvalResult } from "@/lib/phonemeApi";
import type { TurnStatus } from "@/lib/speaking/feedbackModel";
import { SpeakingFeedbackSummary } from "./SpeakingFeedbackSummary";
import type { StreamStatus } from "@/types/ai-speaking";

/** Trạng thái hiển thị của khu voice. Trước đây kiểu này sống chung file với dải sóng giả đã bỏ. */
type SpeakingVizState = "idle" | "listening" | "processing" | "ai-speaking";

/**
 * Vùng PHẢI của bố cục 3 vùng (S-07 §Responsive / B-16 lô 4): trạng thái nói + phản hồi.
 *
 * Bản trước đổ ba khối song song ra đây — danh sách lỗi, bảng phoneme, danh sách gợi ý — nên phản
 * hồi của một lượt trải dài quá màn hình và người học phải cuộn mới biết mình vừa nói thế nào.
 * Nay cả ba là **bằng chứng** nằm sau `SpeakingFeedbackSummary`, mặc định mỗi chiều một dòng
 * (AC-3 của S-07).
 *
 * Khối "câu mở đầu" cũ đã bỏ khỏi đây: `SpeakingChatEmptyState` ở cột giữa đã có đúng bộ câu đó,
 * hai chỗ cùng render một danh sách là thừa chứ không phải là tiện.
 */
interface Props {
  isListening: boolean;
  inputText: string;
  streamStatus: StreamStatus;
  isSpeaking: boolean;
  showSuggestions: boolean;
  suggestions: Suggestion[];
  /** Đ4: gợi ý sinh theo yêu cầu — có mặt ⇒ hiện nút khi chưa có chip nào. */
  suggestionsLoading?: boolean;
  onRequestSuggestions?: () => void;
  /**
   * Lỗi của lượt nói gần nhất — `undefined` khi lượt đó CHƯA được AI phân tích, `[]` khi đã phân
   * tích và sạch lỗi. Giữ nguyên `undefined` thay vì `?? []`: gộp hai thứ lại thì màn hình sẽ báo
   * "Ngữ pháp: Tốt" cho một câu chưa ai chấm.
   */
  analysedErrors: ErrorItem[] | undefined;
  turnStatus: TurnStatus | null;
  turnNote: string | null;
  phonemeResult?: PhonemeEvalResult | null;
  phonemeLoading?: boolean;
  onSuggestionSelect: (text: string) => void;
}

function vizState(
  isListening: boolean,
  streamStatus: StreamStatus,
  isSpeaking: boolean,
): SpeakingVizState {
  if (isListening) return "listening";
  if (streamStatus === "processing") return "processing";
  if (streamStatus === "streaming" || isSpeaking) return "ai-speaking";
  return "idle";
}

export function SpeakingChatSidebar({
  isListening,
  inputText,
  streamStatus,
  isSpeaking,
  showSuggestions,
  suggestions,
  suggestionsLoading,
  onRequestSuggestions,
  analysedErrors,
  turnStatus,
  turnNote,
  phonemeResult,
  phonemeLoading,
  onSuggestionSelect,
}: Props) {
  const t = useTranslations("speaking.chat");
  /**
   * `recorder.*` sống ở namespace `speaking`, KHÔNG phải `speaking.chat` — đọc nhầm chỗ thì
   * next-intl không ném lỗi, nó in thẳng đường dẫn khoá ra màn hình. Panel này vì thế đã hiện
   * chuỗi thô "speaking.chat.recorder.aiSpeaking" cho mọi phiên desktop kể từ lô 2, và
   * `check-i18n-usage.js` mù với nó vì khoá được ghép bằng template literal chứ không phải chuỗi
   * literal. `SpeakingInputDock` đọc đúng namespace — hai chỗ cùng một nhãn mà lệch nguồn.
   */
  const tSpeaking = useTranslations("speaking");
  const viz = vizState(isListening, streamStatus, isSpeaking);

  const showRecordingPanel = isListening || viz !== "idle";
  const showComposing = !isListening && !!inputText.trim();
  const hasFeedback =
    analysedErrors !== undefined ||
    !!phonemeResult ||
    !!turnStatus ||
    (showSuggestions && suggestions.length > 0) ||
    (showSuggestions && suggestions.length === 0 && !!onRequestSuggestions);

  return (
    <aside
      id="speaking-copilot-panel"
      className="ga-ui hidden md:flex md:w-[35%] xl:w-[340px] xl:shrink-0 flex-col border-l border-ga-line bg-ga-card overflow-y-auto"
    >
      <div className="flex-1 space-y-4 p-4">
        {/* ── Trạng thái nói ── */}
        {(showRecordingPanel || streamStatus !== "idle") && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-ga border border-ga-line bg-ga-surface p-4"
          >
            {/* S-07 / B-16 lô 2: bỏ `SpeakingVoiceVisualizer`. Nó vẽ dải sóng bằng biên độ HẰNG SỐ
                (`BASE_AMPLITUDES`) — không đọc micro một chút nào, cộng một vầng blur
                `repeat: Infinity` chạy suốt lúc thu âm. Một dải sóng không liên quan tới tín hiệu
                là nói dối trạng thái (S-14), mà pipeline hiện tại KHÔNG lộ mức tín hiệu ra
                (`useSpeech` chỉ trả boolean). Nên trạng thái ở đây là CHỮ — thật, và đọc được. */}
            <p
              aria-live="polite"
              className={cn(
                "ga-ui flex items-center justify-center gap-1.5 text-ga-small font-semibold",
                viz === "listening" ? "text-ga-red" : "text-ga-muted",
              )}
            >
              {viz === "listening" && (
                <span aria-hidden className="h-2 w-2 rounded-full bg-ga-red" />
              )}
              {tSpeaking(`recorder.${viz === "ai-speaking" ? "aiSpeaking" : viz}`)}
            </p>
            {isListening && inputText && (
              <p className="mt-3 text-center text-sm italic leading-relaxed text-ga-ink">
                &ldquo;{inputText}&rdquo;
              </p>
            )}
            {isListening && !inputText && (
              <p className="mt-2 text-center text-xs text-ga-muted">{t("recordingHint")}</p>
            )}
          </motion.div>
        )}

        {/* ── Đang soạn ── */}
        {showComposing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-ga border border-ga-yellow bg-ga-yellow-soft p-4"
          >
            <div className="mb-2 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-ga-yellow" />
              <span className="text-[10px] font-bold uppercase tracking-wide text-ga-gold">
                {t("composing")}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-ga-muted">{inputText}</p>
          </motion.div>
        )}

        {/* ── Phản hồi 4 chiều, summary-first ── */}
        {hasFeedback ? (
          <SpeakingFeedbackSummary
            analysedErrors={analysedErrors}
            suggestions={suggestions}
            suggestionsVisible={showSuggestions}
            suggestionsLoading={suggestionsLoading}
            onRequestSuggestions={onRequestSuggestions}
            phonemeResult={phonemeResult ?? null}
            turnStatus={turnStatus}
            turnNote={turnNote}
            phonemeLoading={phonemeLoading}
            onSuggestionSelect={onSuggestionSelect}
          />
        ) : (
          !showRecordingPanel &&
          !showComposing && (
            <p className="px-1 py-6 text-center text-[12px] leading-relaxed text-ga-muted">
              {t("feedbackEmptyHint")}
            </p>
          )
        )}
      </div>
    </aside>
  );
}
