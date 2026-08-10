"use client";

import { type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lightbulb, Mic, AlertCircle, Info, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Suggestion, ErrorItem } from "@/lib/aiSpeakingApi";
import type { PhonemeEvalResult } from "@/lib/phonemeApi";
import { SpeakingPhonemePanel } from "./SpeakingPhonemePanel";
import {
  SpeakingVoiceVisualizer,
  type SpeakingVizState,
} from "@/components/speaking/SpeakingVoiceVisualizer";
import type { StreamStatus } from "@/types/ai-speaking";

interface Props {
  isListening: boolean;
  inputText: string;
  streamStatus: StreamStatus;
  isSpeaking: boolean;
  showSuggestions: boolean;
  suggestions: Suggestion[];
  lastUserErrors: ErrorItem[];
  companionName: string;
  personaRole?: string;
  sessionTopic?: string | null;
  phonemeResult?: PhonemeEvalResult | null;
  phonemeLoading?: boolean;
  /** Đ4: gợi ý sinh theo yêu cầu — có mặt ⇒ hiện nút khi chưa có chip nào. */
  suggestionsLoading?: boolean;
  onRequestSuggestions?: () => void;
  /**
   * Học viên đã nói ít nhất một câu chưa. Starters là CÂU MỞ ĐẦU hội thoại — giữa cuộc
   * nói chuyện mà hiện lại thì lạc đề với câu hỏi hiện tại của AI (QA prod 04/08 23:40).
   */
  hasUserSpoken?: boolean;
  onSuggestionSelect: (text: string) => void;
  onStarterSelect: (text: string) => void;
  /**
   * QA 09/08 (J5): link "Xem N lỗi" trong bong bóng chat cần mở được panel desktop —
   * state mở panel nâng lên cha (controlled) thay vì nội bộ, để mọi lối vào cùng một nguồn.
   */
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
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
  lastUserErrors,
  companionName,
  personaRole,
  sessionTopic,
  phonemeResult,
  phonemeLoading,
  suggestionsLoading,
  onRequestSuggestions,
  hasUserSpoken,
  onSuggestionSelect,
  onStarterSelect,
  panelOpen,
  onPanelOpenChange: setPanelOpen,
}: Props) {
  const t = useTranslations("speaking.chat");
  const viz = vizState(isListening, streamStatus, isSpeaking);

  const showRecordingPanel = isListening || viz !== "idle";
  const showComposing = !isListening && !!inputText.trim();
  const showSuggestionPanel = showSuggestions && suggestions.length > 0;
  // Đ4: chưa có chip nào nhưng bấm được — hiện nút yêu cầu thay vì im lặng.
  const showSuggestionRequest =
    showSuggestions && suggestions.length === 0 && !!onRequestSuggestions;
  const showCorrections = lastUserErrors.length > 0;
  const showPhoneme = !!phonemeResult || phonemeLoading;
  const showEmpty =
    !showRecordingPanel &&
    !showComposing &&
    !showSuggestionPanel &&
    !showSuggestionRequest &&
    !showCorrections &&
    !showPhoneme;

  const starters = [
    t("starter1"),
    t("starter2"),
    t("starter3"),
  ] as const;

  // Redesign 05/08 (owner chốt): rail icon mỏng mở-khi-cần thay sidebar 35% cố định —
  // chat chiếm gần trọn bề ngang, panel trượt phủ lên khi bấm icon.
  return (
    <aside
      id="speaking-copilot-panel"
      className="ga-ui hidden md:flex relative border-l border-ga-line bg-ga-card"
    >
      <div className="w-14 flex flex-col items-center gap-1.5 py-4">
        <RailButton
          label={t("suggestionsTitle")}
          active={panelOpen}
          badge={showSuggestionRequest || showSuggestionPanel}
          onClick={() => setPanelOpen(!panelOpen)}
        >
          <Lightbulb size={18} />
        </RailButton>
        <RailButton
          label={t("correctionsTitle")}
          active={false}
          badge={showCorrections}
          onClick={() => setPanelOpen(true)}
        >
          <AlertCircle size={18} />
        </RailButton>
        <RailButton
          label={t("micTitle")}
          active={false}
          badge={!!showPhoneme}
          onClick={() => setPanelOpen(true)}
        >
          <Mic size={18} />
        </RailButton>
        <RailButton label={companionName} active={false} badge={false} onClick={() => setPanelOpen(true)}>
          <Info size={18} />
        </RailButton>
      </div>

      <AnimatePresence>
        {panelOpen && (
          <motion.div
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 24, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute right-full top-0 bottom-0 w-[340px] overflow-y-auto border-l border-ga-line bg-ga-card shadow-xl z-30"
          >
            <div className="flex items-center justify-end px-2 pt-2">
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="p-1.5 rounded-ga text-ga-muted hover:text-ga-ink hover:bg-ga-surface transition-colors"
                aria-label={t("closePanel")}
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 pt-1 space-y-4 flex-1">
        {/* ── Voice / status ── */}
        {(showRecordingPanel || streamStatus !== "idle") && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-ga p-4 border border-ga-line bg-ga-surface"
          >
            <SpeakingVoiceVisualizer state={viz} />
            {isListening && inputText && (
              <p className="text-sm text-ga-ink leading-relaxed italic mt-3 text-center">
                &ldquo;{inputText}&rdquo;
              </p>
            )}
            {isListening && !inputText && (
              <p className="text-xs text-ga-muted text-center mt-2">{t("recordingHint")}</p>
            )}
          </motion.div>
        )}

        {/* ── Composing preview ── */}
        {showComposing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-ga p-4 border border-ga-yellow bg-ga-yellow-soft"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-ga-yellow" />
              <span className="text-[10px] font-bold text-ga-gold uppercase tracking-wide">
                {t("composing")}
              </span>
            </div>
            <p className="text-sm text-ga-muted leading-relaxed">{inputText}</p>
          </motion.div>
        )}

        {/* ── Pronunciation (deterministic Phoneme) ── */}
        {showPhoneme && phonemeResult && (
          <SpeakingPhonemePanel result={phonemeResult} loading={phonemeLoading} />
        )}

        {/* ── Corrections on last user turn ── */}
        {showCorrections && (
          <div className="rounded-ga p-4 border border-ga-red bg-ga-red-soft space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="text-ga-red flex-shrink-0" />
              <span className="text-[10px] font-bold text-ga-red uppercase tracking-wide">
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
                    <p className="text-ga-red line-through text-[13px] mb-1">&quot;{err.wrongSpan}&quot;</p>
                  )}
                  {err.correctedSpan && (
                    <p className="text-ga-green font-medium text-[13px]">
                      → &quot;{err.correctedSpan}&quot;
                    </p>
                  )}
                  {err.ruleViShort && (
                    <p className="text-ga-muted text-[12px] mt-1">{err.ruleViShort}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Đ4: nút yêu cầu gợi ý (backend không sinh kèm lượt chat nữa) ── */}
        <AnimatePresence>
          {showSuggestionRequest && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              onClick={onRequestSuggestions}
              disabled={suggestionsLoading}
              className="w-full flex items-center gap-2 p-3 rounded-ga bg-ga-surface border border-ga-line hover:border-ga-accent hover:bg-ga-accent-soft transition-colors disabled:opacity-60"
            >
              <Lightbulb size={14} className="text-ga-gold flex-shrink-0" />
              <span className="text-[12px] font-semibold text-ga-ink">
                {suggestionsLoading ? t("suggestionsLoading") : t("suggestionsRequest")}
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── Suggestions (full metadata) ── */}
        <AnimatePresence>
          {showSuggestionPanel && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="space-y-2"
            >
              <div className="flex items-center gap-2">
                <Lightbulb size={13} className="text-ga-gold" />
                <span className="text-[10px] font-bold text-ga-gold uppercase tracking-wide">
                  {t("suggestionsTitle")}
                </span>
              </div>
              {suggestions.map((s, i) => (
                <motion.button
                  key={i}
                  type="button"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  onClick={() => onSuggestionSelect(s.german_text)}
                  className="w-full text-left p-3 rounded-ga transition-colors bg-ga-surface border border-ga-line hover:border-ga-accent hover:bg-ga-accent-soft"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-ga-ink leading-snug">
                      {s.german_text}
                    </p>
                    {s.level && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-ga bg-ga-yellow-soft text-ga-gold flex-shrink-0">
                        {s.level}
                      </span>
                    )}
                  </div>
                  {s.vietnamese_translation && (
                    <p className="text-[12px] text-ga-muted mt-1 italic">
                      {s.vietnamese_translation}
                    </p>
                  )}
                  {s.why_to_use && (
                    <p className="text-[11px] text-ga-subtle mt-1.5 line-clamp-2">
                      {s.why_to_use}
                    </p>
                  )}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Empty state with starters ── */}
        {showEmpty && (
          <div className="flex flex-col gap-4 py-6">
            <div className="text-center">
              <Mic size={28} className="mx-auto mb-2 text-ga-subtle" />
              <p className="text-xs font-semibold text-ga-ink">{t("emptyTitle")}</p>
              <p className="text-[11px] text-ga-muted mt-1 max-w-[220px] mx-auto leading-relaxed">
                {t("emptyHint", { name: companionName })}
              </p>
              {personaRole && (
                <p className="text-[10px] text-ga-subtle mt-2 italic">{personaRole}</p>
              )}
              {sessionTopic && (
                <p className="text-[10px] font-semibold text-ga-blue mt-2">
                  {t("sessionMission", { topic: sessionTopic })}
                </p>
              )}
            </div>
            {/* Starters = câu MỞ ĐẦU — chỉ hợp lý khi học viên chưa nói câu nào; giữa hội
                thoại thì lạc đề với câu hỏi hiện tại của AI (nút "Gợi ý" mới là thứ đúng). */}
            {!hasUserSpoken && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-ga-subtle uppercase tracking-wide px-1">
                  {t("startersTitle")}
                </p>
                {starters.map((phrase, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onStarterSelect(phrase)}
                    className="w-full text-left text-sm px-3 py-2.5 rounded-ga border border-ga-line bg-ga-surface text-ga-ink hover:border-ga-accent transition-colors"
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}

/** Nút icon trên rail 56px — chấm vàng khi mục tương ứng đang có nội dung đáng xem. */
function RailButton({
  label,
  active,
  badge,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  badge: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={
        "relative w-10 h-10 rounded-ga flex items-center justify-center transition-colors " +
        (active
          ? "bg-ga-yellow-soft text-ga-gold border border-ga-yellow"
          : "text-ga-muted hover:text-ga-ink hover:bg-ga-surface border border-transparent")
      }
    >
      {children}
      {badge && (
        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-ga-yellow" aria-hidden />
      )}
    </button>
  );
}
