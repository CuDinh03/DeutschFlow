"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Mic, MicOff, Loader2, Keyboard, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { lightImpact } from "@/lib/haptics";

/**
 * SpeakingInputDock — khu hành động của phiên luyện nói (S-07 / B-16 lô 2).
 *
 * **Đảo thứ bậc.** Bản cũ đặt ô nhập chữ chiếm `flex-1` với nút mic 48px nép bên trái, nên thứ to
 * nhất trên màn hình là chỗ để GÕ. Mục tiêu của sản phẩm là luyện NÓI, mà bố cục lại mời gõ —
 * đúng chẩn đoán UX-05 của plan. Nay nút mic là hành động chính, lớn nhất, đứng giữa; đường gõ
 * vẫn còn (plan §Risk: "giữ đường text ở drill") nhưng thu về một nút mở, không chiếm chỗ trung tâm.
 *
 * **Không có waveform, và đó là chủ ý.** Plan vẽ một dải sóng cạnh nút mic. Pipeline ghi âm hiện
 * tại KHÔNG hề lộ mức tín hiệu ra ngoài: `useSpeech` chỉ trả `isListening`/`isSpeaking`, không có
 * analyser, không có amplitude. `SpeakingVoiceVisualizer` sẵn có thì vẽ bằng biên độ HẰNG SỐ, tức
 * một dải sóng không liên quan gì tới micro — vẽ nó ra là nói dối trạng thái (S-14). Trạng thái ở
 * đây vì thế là CHỮ + `aria-live`, thứ vừa thật vừa đọc được bằng screen reader.
 *
 * **Không nhấp nháy.** Bản cũ dùng `animate-pulse` cho cả nút mic lẫn nhãn "REC". Trạng thái đang
 * ghi âm nay báo bằng màu + chấm đặc + chữ — không animation, đúng hợp đồng reduced-motion.
 */
interface Props {
  inputText: string;
  onInputChange: (v: string) => void;
  onSubmit: () => void;
  isListening: boolean;
  isTranscribing: boolean;
  isEvaluatingPhoneme: boolean;
  streamIdle: boolean;
  repairBlocking: boolean;
  quotaBlocked?: boolean;
  /** Mic capture failed (permission/device) — reflect a blocked state. */
  micBlocked?: boolean;
  companionName: string;
  inputTip: string;
  onToggleMic: () => void;
  suggestionWaitSec?: number;
  showSuggestionHint?: boolean;
}

export function SpeakingInputDock({
  inputText,
  onInputChange,
  onSubmit,
  isListening,
  isTranscribing,
  isEvaluatingPhoneme,
  streamIdle,
  repairBlocking,
  quotaBlocked = false,
  micBlocked = false,
  companionName,
  inputTip,
  onToggleMic,
  showSuggestionHint,
}: Props) {
  const t = useTranslations("speaking");
  const tChat = useTranslations("speaking.chat");
  // Redesign R1 (05/08): textarea rows=1 không tự cao — câu dài/transcript mic bị cắt dòng 2.
  // Auto-grow theo scrollHeight, trần max-h (~5 dòng) rồi mới scroll trong ô.
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [inputText]);
  const micBusy = isTranscribing || isEvaluatingPhoneme;
  const inputDisabled = quotaBlocked || repairBlocking;
  // Show the blocked affordance only when idle (not while recording/working).
  const showMicBlocked = micBlocked && !isListening && !micBusy;
  const micLabel = showMicBlocked ? t("micRetry") : tChat("micTitle");

  const [typing, setTyping] = useState(false);
  // Gợi ý (và mọi thứ khác đổ chữ vào ô nhập) phải KÉO ô nhập hiện ra — nếu không, chữ đã điền
  // nằm sau một nút đóng và người dùng tưởng cú bấm gợi ý không ăn.
  useEffect(() => {
    if (inputText.trim()) setTyping(true);
  }, [inputText]);

  const statusLabel = isListening
    ? t("recorder.listening")
    : micBusy
      ? t("recorder.processing")
      : showMicBlocked
        ? t("micRetry")
        : t("recorder.idle");

  return (
    <footer className="ga-ui shrink-0 border-t border-ga-line bg-ga-card p-3 sm:p-4">
      <div className="mx-auto w-full max-w-2xl">
        {/* ── Hành động chính: nói ─────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => {
              lightImpact();
              onToggleMic();
            }}
            disabled={micBusy || inputDisabled}
            aria-pressed={isListening}
            aria-label={micLabel}
            title={micLabel}
            className={cn(
              "flex items-center justify-center rounded-full transition-colors",
              "h-20 w-20 sm:h-[88px] sm:w-[88px]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ga-card",
              isListening
                ? "bg-ga-red text-white"
                : showMicBlocked
                  ? "border border-ga-yellow bg-ga-yellow-soft text-ga-gold hover:bg-ga-yellow hover:text-ga-ink"
                  : "bg-ga-ink text-ga-bg hover:opacity-90",
              (micBusy || inputDisabled) && "opacity-40",
            )}
          >
            {micBusy ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : isListening || showMicBlocked ? (
              <MicOff className="h-8 w-8" />
            ) : (
              <Mic className="h-8 w-8" />
            )}
          </button>

          {/* Trạng thái ghi âm bằng CHỮ — không chỉ bằng màu, không nhấp nháy. */}
          <p
            aria-live="polite"
            className={cn(
              "flex items-center gap-1.5 text-ga-small font-semibold",
              isListening ? "text-ga-red" : "text-ga-muted",
            )}
          >
            {isListening && <span aria-hidden className="h-2 w-2 rounded-full bg-ga-red" />}
            {statusLabel}
          </p>
        </div>

        {/* ── Đường thứ yếu: gõ thay vì nói ────────────────────────────────── */}
        <div className="mt-3 border-t border-ga-line pt-3">
          {!typing ? (
            <button
              type="button"
              onClick={() => setTyping(true)}
              disabled={inputDisabled}
              className="mx-auto flex min-h-11 items-center gap-2 rounded-ga px-3 text-ga-small font-medium text-ga-muted transition-colors hover:bg-ga-surface hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-inset disabled:opacity-40 lg:min-h-0 lg:py-2"
            >
              <Keyboard size={16} aria-hidden />
              {tChat("typeInstead")}
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
              }}
              className="flex items-end gap-2"
            >
              <div className="flex flex-1 items-end gap-2 rounded-ga border border-ga-line bg-ga-surface px-2 py-1.5 transition-colors focus-within:border-ga-accent focus-within:ring-1 focus-within:ring-ga-accent">
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  autoFocus
                  onChange={(e) => onInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!inputDisabled) onSubmit();
                    }
                  }}
                  disabled={inputDisabled}
                  placeholder={
                    quotaBlocked
                      ? tChat("quotaBlockedInputPlaceholder")
                      : tChat("inputPlaceholder", { name: companionName })
                  }
                  className="max-h-28 min-h-[44px] flex-1 resize-none border-none bg-transparent px-1 py-2.5 text-[15px] text-ga-ink outline-none placeholder:text-ga-subtle disabled:opacity-50"
                  rows={1}
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || !streamIdle || inputDisabled}
                  className="mb-0.5 shrink-0 rounded-ga bg-ga-yellow p-2.5 text-ga-ink transition-opacity hover:opacity-90 disabled:opacity-35"
                  aria-label={tChat("sendMessage")}
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setTyping(false)}
                aria-label={tChat("typeInsteadClose")}
                className="mb-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-ga text-ga-muted transition-colors hover:bg-ga-surface hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-inset"
              >
                <ChevronDown size={18} aria-hidden />
              </button>
            </form>
          )}
        </div>

        <div className="mt-2 space-y-0.5 text-center">
          <span className="block text-ga-caption text-ga-muted">{inputTip}</span>
          {showSuggestionHint && typing && (
            <span className="hidden text-ga-caption text-ga-subtle sm:block">{tChat("shortcutHint")}</span>
          )}
        </div>
      </div>
    </footer>
  );
}
