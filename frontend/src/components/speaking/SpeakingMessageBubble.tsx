"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Volume2, Info, CheckCircle2, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { speakGerman } from "@/lib/speechDe";
import { cn } from "@/lib/utils";
import { AiMessageBubble, CYAN, MINT, SPEAKING_LIGHT } from "./types";
import { personaInk, personaSoft } from "@/lib/personaPaper";
import { UserTextWithErrorSpans } from "./UserTextWithErrorSpans";
import { parseActionChips } from "./actionChips";
import { SpeakingPersonaMiniAvatar } from "./SpeakingPersonaMiniAvatar";
import { SpeakingFeedbackCompact } from "@/components/features/ai-speaking/SpeakingFeedbackCompact";
import { getErrorSnippet } from "@/lib/errors/errorTaxonomy";
import {
  getPersonaV2VisualTokens,
  normalizeSpeakingPersona,
  personaActionChipClasses,
  type PersonaV2VisualTokens,
} from "./personaTheme";

export interface SpeakingMessageBubbleProps {
  msg: AiMessageBubble;
  showExplanations: boolean;
  sessionResponseSchema?: "V1" | "V2" | string;
  onSuggestionClick?: (text: string) => void;
  onCorrect?: (code: string, correct: string, rule: string) => void;
  /** For themed action chips (Lukas / Emma). */
  personaId?: string | null;
  /** UIDemo AIChat-style assistant bubble colors (V2 companion layout). */
  personaV2Tokens?: PersonaV2VisualTokens | null;
  /** Interview mode: emphasize long AI prompts with stream-ghost styling (e.g. multi-sentence questions). */
  interviewGhost?: boolean;
  /** Override default TTS (e.g. persona voice from chat page). */
  onAiSpeak?: (text: string) => void;
  /** Open copilot panel when user taps error summary under their bubble. */
  onUserErrorsClick?: () => void;
  /** AI avatar animation while streaming / processing. */
  aiChatBusy?: boolean;
}

export function SpeakingMessageBubble({
  msg,
  showExplanations,
  sessionResponseSchema = "V1",
  onSuggestionClick,
  onCorrect: _onCorrect,
  personaId,
  personaV2Tokens,
  interviewGhost = false,
  onAiSpeak,
  onUserErrorsClick,
  aiChatBusy = false,
}: SpeakingMessageBubbleProps) {
  const t = useTranslations("speaking");
  const tChat = useTranslations("speaking.chat");
  const reduceMotion = useReducedMotion();
  const isV2 = sessionResponseSchema === "V2";
  // Warm paper only — the dark chat shell is gone, so there is a single appearance.
  const L = SPEAKING_LIGHT;
  const pid = normalizeSpeakingPersona(personaId ?? undefined);
  const v2Tokens = personaV2Tokens ?? getPersonaV2VisualTokens(pid);
  // Persona hue, darkened for text / tinted for fills (lib/personaPaper).
  const accentInk = personaInk(v2Tokens.accent);
  const actionChips = isV2 ? parseActionChips(msg.action ?? undefined) : [];

  if (msg.role === "USER") {
    const text = msg.userText ?? "";
    return (
      <motion.div
        layout
        className="flex justify-end font-sans"
        initial={reduceMotion ? false : { opacity: 0, x: 16, scale: 0.98 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0, x: 8 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="max-w-[min(82%,28rem)]">
          <p className="text-[10px] mb-1.5 text-right font-medium" style={{ color: L.inkSoft }}>
            {t("bubbleYou")}
          </p>
          <motion.div
            whileHover={{ scale: 1.01 }}
            className="rounded-2xl rounded-tr-md px-4 py-3 border transition-transform duration-200"
            style={{ background: L.chatUserBg, borderColor: L.chatUserBorder }}
          >
            <p className="text-[15px] leading-relaxed break-words" style={{ color: L.ink }}>
              <UserTextWithErrorSpans text={text} errors={msg.errors} />
            </p>
            {msg.errors && msg.errors.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <div className="flex flex-wrap justify-end gap-1">
                  {msg.errors.map((e) => (
                    <span
                      key={e.errorCode + (e.wrongSpan ?? "")}
                      className="text-[9px] font-bold px-2 py-0.5 rounded-full max-w-[160px] truncate border"
                      style={{
                        background: "#FFFFFF",
                        borderColor: L.line,
                        color: L.inkMuted,
                      }}
                      title={e.errorCode}
                    >
                      {getErrorSnippet(e.errorCode, 'vi').title}
                    </span>
                  ))}
                </div>
                {onUserErrorsClick && (
                  <button
                    type="button"
                    onClick={onUserErrorsClick}
                    className="text-[11px] font-semibold text-ga-accent hover:text-ga-ink underline-offset-2 hover:underline"
                  >
                    {tChat("viewErrors", { n: msg.errors.length })}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      className="flex items-start gap-3 font-sans"
      initial={reduceMotion ? false : { opacity: 0, x: -16, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0, x: -8 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <SpeakingPersonaMiniAvatar
        personaId={personaId}
        chatBusy={aiChatBusy || !!msg.isStreaming}
        className="w-10 h-10 flex-shrink-0 border border-ga-line"
      />

      <div className="flex-1 max-w-[min(82%,28rem)] space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: L.inkSoft }}>
            {t("bubbleAi")}
          </p>
          {msg.newWord && (
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${MINT}22`, color: MINT, border: `1px solid ${MINT}44` }}
            >
              {t("newWordBadge")}: {msg.newWord}
            </span>
          )}
          {msg.userInterestDetected && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-ga-yellow bg-ga-yellow-soft text-ga-gold">
              ✨ {msg.userInterestDetected}
            </span>
          )}
          {msg.errors?.map((e) => (
            <span
              key={e.errorCode + e.severity}
              className="text-[9px] font-bold px-2 py-0.5 rounded-full max-w-[140px] truncate border"
              title={e.errorCode}
              style={{
                background: e.severity?.toUpperCase().includes("BLOCK")
                  ? "var(--ga-red-soft)"
                  : e.severity?.toUpperCase().includes("MAJOR")
                    ? "var(--ga-orange-soft)"
                    : "var(--ga-surface)",
                color: e.severity?.toUpperCase().includes("BLOCK")
                  ? "var(--ga-red)"
                  : e.severity?.toUpperCase().includes("MAJOR")
                    ? "var(--ga-orange)"
                    : L.inkMuted,
                borderColor: L.line,
              }}
            >
              {getErrorSnippet(e.errorCode, 'vi').title}
            </span>
          ))}
        </div>

        {/* Primary content — V2: large German + muted translation hierarchy */}
        <div
          className={cn(
            "rounded-2xl rounded-tl-md px-4 py-4 border transition-shadow duration-300",
            (msg.isStreaming || interviewGhost) && "df-stream-ghost",
          )}
          style={{
            // Persona identity survives as a tinted card on paper, not a dark slab.
            background: personaSoft(v2Tokens.accent, 0.06),
            borderColor: personaSoft(v2Tokens.accent, 0.3),
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-2">
              <p
                className={cn(
                  "relative leading-snug font-semibold tracking-tight",
                  isV2 ? "text-[17px] sm:text-lg" : "text-[15px]",
                )}
                style={{ color: msg.isStreaming ? L.inkMuted : L.ink }}
              >
                <span className="relative z-[1]">{msg.aiSpeechDe}</span>
                {msg.isStreaming && (
                  <motion.span
                    className="inline-block w-[2px] h-[1.1em] ml-1 rounded-full align-middle"
                    style={{ background: accentInk }}
                    animate={reduceMotion ? { opacity: 1 } : { opacity: [1, 0] }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.55, repeat: Infinity }}
                  />
                )}
              </p>
              {isV2 && msg.explanationVi ? (
                <p className="text-sm leading-relaxed" style={{ color: L.inkMuted }}>
                  <span className="text-[10px] font-bold uppercase tracking-wider block mb-1 opacity-70">
                    {t("labelTranslation")}
                  </span>
                  {msg.explanationVi}
                </p>
              ) : null}
            </div>
            {msg.aiSpeechDe && !msg.isStreaming && (
              <motion.button
                type="button"
                aria-label={t("bubblePlayTts")}
                onClick={() =>
                  onAiSpeak ? onAiSpeak(msg.aiSpeechDe!) : speakGerman(msg.aiSpeechDe!)
                }
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center border transition-colors"
                style={{ background: "#FFFFFF", borderColor: L.line }}
              >
                <Volume2 size={14} style={{ color: accentInk }} aria-hidden />
              </motion.button>
            )}
          </div>
        </div>

        {/* V2 feedback — soft alert callout */}
        {isV2 && msg.feedback && (
          <div
            className={cn(
              "rounded-ga border border-ga-line bg-ga-surface px-4 py-3 flex items-start gap-3",
              msg.status === "OFF_TOPIC" && "border-l-4 border-l-ga-red bg-ga-red-soft",
              msg.status === "EXCELLENT" && "border-l-4 border-l-ga-green bg-ga-green-soft",
              msg.status === "ON_TOPIC_NEEDS_IMPROVEMENT" && "border-l-4 border-l-ga-yellow bg-ga-yellow-soft",
            )}
          >
            {msg.status === "OFF_TOPIC" ? (
              <AlertCircle size={16} className="flex-shrink-0 text-ga-red mt-0.5" />
            ) : (
              <CheckCircle2 size={16} className="flex-shrink-0 text-ga-green mt-0.5" />
            )}
            <p className="text-sm leading-relaxed text-ga-ink">{msg.feedback}</p>
          </div>
        )}

        {/* V1 guard feedback (non-V2 contract) */}
        {!isV2 && msg.feedback && (
          <div
            className={`rounded-ga px-4 py-3 flex items-center gap-2 border ${
              msg.status === "OFF_TOPIC"
                ? "bg-ga-red-soft border-ga-red text-ga-red"
                : msg.status === "EXCELLENT"
                  ? "bg-ga-green-soft border-ga-green text-ga-green"
                  : "bg-ga-yellow-soft border-ga-yellow text-ga-gold"
            }`}
          >
            {msg.status === "OFF_TOPIC" ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
            <p className="text-[13px] font-medium">{msg.feedback}</p>
          </div>
        )}

        {/* V2 action — suggestion chips */}
        {isV2 && actionChips.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {actionChips.map((chip, idx) => (
              <motion.button
                key={`${msg.id}-action-${idx}`}
                type="button"
                onClick={() => onSuggestionClick?.(chip)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className={personaActionChipClasses(pid)}
              >
                {chip}
              </motion.button>
            ))}
          </div>
        )}

        {/* V1 scaffolding suggestions.
           Filter empty `german_text` first — the LLM stream lands the
           suggestions array before the inner strings, so without this guard
           we render skeleton cards with only a level badge while the model
           is still typing. Also caps at 2 per Pingo-style guidance (less
           decision paralysis than 3). */}
        {!isV2 && msg.suggestions && (() => {
          const filled = msg.suggestions.filter(s => s.german_text?.trim().length);
          if (filled.length === 0) return null;
          const visible = filled.slice(0, 2);
          return (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: L.inkSoft }}>
              {t("suggestionsTitle")}:
            </p>
            <div className="grid gap-2">
              {visible.map((s, idx) => (
                <div key={idx} className="group relative">
                  <motion.button
                    type="button"
                    onClick={() => onSuggestionClick?.(s.german_text)}
                    whileHover={{ scale: 1.01 }}
                    className="w-full text-left rounded-ga px-4 py-3 bg-ga-surface border border-ga-line transition-colors group-hover:border-ga-yellow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[14px] font-medium" style={{ color: L.ink }}>
                            {s.german_text}
                          </p>
                          {s.lego_structure && (
                            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-ga-card text-ga-muted border border-ga-line">
                              {s.lego_structure}
                            </span>
                          )}
                        </div>
                        <p className="text-[12px]" style={{ color: L.inkMuted }}>
                          {s.vietnamese_translation}
                        </p>
                      </div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-ga-card text-ga-muted border border-ga-line">
                        {s.level}
                      </span>
                    </div>
                  </motion.button>
                  <div className="absolute -right-1 -top-1 z-10">
                    <div className="group/info relative">
                      <button
                        type="button"
                        className="p-1.5 rounded-full bg-ga-card border border-ga-line text-ga-muted hover:text-ga-gold transition-colors shadow-ga-card-hover"
                      >
                        <Info size={11} />
                      </button>
                      <div className="invisible group-hover/info:visible absolute bottom-full right-0 mb-2 w-64 p-4 rounded-ga bg-ga-card border border-ga-line shadow-ga-panel z-20">
                        <div className="mb-3 pb-3 border-b border-ga-line">
                          <p className="text-[10px] font-bold text-ga-gold uppercase mb-1">Tại sao dùng câu này?</p>
                          <p className="text-[12px] text-ga-ink leading-relaxed">{s.why_to_use}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-ga-violet uppercase mb-1">Hoàn cảnh sử dụng:</p>
                          <p className="text-[12px] text-ga-muted leading-relaxed">{s.usage_context}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          );
        })()}

        {showExplanations && (
          <SpeakingFeedbackCompact msg={msg} isV2={isV2} />
        )}
      </div>
    </motion.div>
  );
}
