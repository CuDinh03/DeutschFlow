"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Volume2, Info, CheckCircle2, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { speakGerman } from "@/lib/speechDe";
import { cn } from "@/lib/utils";
import {
  AiMessageBubble,
  CYAN,
  MINT,
  SPEAKING_LIGHT,
  SPEAKING_DARK,
} from "./types";
import { UserTextWithErrorSpans } from "./UserTextWithErrorSpans";
import { parseActionChips } from "./actionChips";
import { SpeakingPersonaMiniAvatar } from "./SpeakingPersonaMiniAvatar";
import { SpeakingFeedbackCompact } from "@/components/features/ai-speaking/SpeakingFeedbackCompact";
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
  appearance?: "light" | "dark";
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
  appearance = "light",
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
  const d = appearance === "dark";
  const L = d ? SPEAKING_DARK : SPEAKING_LIGHT;
  const pid = normalizeSpeakingPersona(personaId ?? undefined);
  const v2Tokens = personaV2Tokens ?? getPersonaV2VisualTokens(pid);
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
            className={cn(
              "rounded-2xl rounded-tr-md px-4 py-3 border transition-transform duration-200",
              d && "border-white/12",
              pid === "EMMA" && d && "border-amber-400/25 shadow-[0_8px_30px_rgba(245,158,11,0.06)]",
              pid === "LUKAS" && d && "border-sky-400/25 shadow-[0_8px_30px_rgba(56,189,248,0.06)]",
            )}
            style={
              d
                ? { background: L.chatUserBg }
                : { background: L.chatUserBg, borderColor: L.chatUserBorder }
            }
          >
            <p className="text-[15px] leading-relaxed break-words" style={{ color: L.ink }}>
              <UserTextWithErrorSpans text={text} errors={msg.errors} dark={d} />
            </p>
            {msg.errors && msg.errors.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <div className="flex flex-wrap justify-end gap-1">
                  {msg.errors.map((e) => (
                    <span
                      key={e.errorCode + (e.wrongSpan ?? "")}
                      className="text-[9px] font-bold px-2 py-0.5 rounded-full max-w-[160px] truncate border border-white/15"
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        color: L.inkMuted,
                      }}
                      title={e.errorCode}
                    >
                      {e.errorCode.split(".").pop()}
                    </span>
                  ))}
                </div>
                {onUserErrorsClick && (
                  <button
                    type="button"
                    onClick={onUserErrorsClick}
                    className="text-[11px] font-semibold text-cyan-400/90 hover:text-cyan-300 underline-offset-2 hover:underline"
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
        className="w-10 h-10 flex-shrink-0 border-2 border-white/15 shadow-[0_0_20px_rgba(34,211,238,0.2)]"
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
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-amber-400/30 bg-amber-500/15 text-amber-200">
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
                  ? "rgba(248,113,113,0.2)"
                  : e.severity?.toUpperCase().includes("MAJOR")
                    ? "rgba(251,146,60,0.18)"
                    : "rgba(148,163,184,0.2)",
                color: e.severity?.toUpperCase().includes("BLOCK") ? "#FCA5A5" : "#FDBA74",
                borderColor: L.line,
              }}
            >
              {e.errorCode.split(".").pop()}
            </span>
          ))}
        </div>

        {/* Primary content — V2: large German + muted translation hierarchy */}
        <div
          className={cn(
            "rounded-2xl rounded-tl-md px-4 py-4 border backdrop-blur-md transition-shadow duration-300",
            (msg.isStreaming || interviewGhost) &&
              "shadow-[0_0_32px_rgba(34,211,238,0.12)] df-stream-ghost",
          )}
          style={{
            background: v2Tokens.bubble,
            borderColor: v2Tokens.border,
            boxShadow: `0 8px 40px rgba(0,0,0,0.35), 0 0 1px ${v2Tokens.accent}40`,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-2">
              <p
                className={cn(
                  "relative leading-snug font-semibold tracking-tight",
                  isV2 ? "text-[17px] sm:text-lg" : "text-[15px]",
                )}
                style={{
                  color: d
                    ? msg.isStreaming
                      ? "rgba(255,255,255,0.72)"
                      : "rgba(255,255,255,0.95)"
                    : L.ink,
                }}
              >
                {msg.isStreaming && (msg.aiSpeechDe?.length ?? 0) > 0 && d && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-0 top-0 z-0 whitespace-pre-wrap break-words text-white/[0.14] blur-[0.3px] transition-opacity"
                  >
                    {msg.aiSpeechDe}
                  </span>
                )}
                <span className="relative z-[1]">{msg.aiSpeechDe}</span>
                {msg.isStreaming && (
                  <motion.span
                    className="inline-block w-[2px] h-[1.1em] ml-1 rounded-full align-middle"
                    style={{ background: CYAN }}
                    animate={reduceMotion ? { opacity: 1 } : { opacity: [1, 0] }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.55, repeat: Infinity }}
                  />
                )}
              </p>
              {isV2 && msg.explanationVi ? (
                <p className="text-sm leading-relaxed" style={{ color: d ? "rgba(255,255,255,0.48)" : SPEAKING_LIGHT.inkMuted }}>
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
                style={
                  d
                    ? { background: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.14)" }
                    : { background: "#f1f5f9", borderColor: "rgba(15,23,42,0.12)" }
                }
              >
                <Volume2 size={14} style={{ color: CYAN }} aria-hidden />
              </motion.button>
            )}
          </div>
        </div>

        {/* V2 feedback — soft alert callout */}
        {isV2 && msg.feedback && (
          <div
            className={cn(
              "rounded-2xl border px-4 py-3 flex items-start gap-3 shadow-sm",
              d ? "border-white/10 bg-white/[0.04]" : "border-slate-200/80 bg-slate-50/90",
              msg.status === "OFF_TOPIC" && "border-l-4 border-l-red-400 bg-red-500/[0.07]",
              msg.status === "EXCELLENT" && "border-l-4 border-l-emerald-400 bg-emerald-500/[0.07]",
              msg.status === "ON_TOPIC_NEEDS_IMPROVEMENT" && "border-l-4 border-l-amber-400 bg-amber-500/[0.07]",
            )}
          >
            {msg.status === "OFF_TOPIC" ? (
              <AlertCircle size={16} className="flex-shrink-0 text-red-300 mt-0.5" />
            ) : (
              <CheckCircle2 size={16} className="flex-shrink-0 text-emerald-300/90 mt-0.5" />
            )}
            <p className={cn("text-sm leading-relaxed", d ? "text-white/85" : "text-slate-800")}>{msg.feedback}</p>
          </div>
        )}

        {/* V1 guard feedback (non-V2 contract) */}
        {!isV2 && msg.feedback && (
          <div
            className={`rounded-2xl px-4 py-3 flex items-center gap-2 border ${
              d
                ? msg.status === "OFF_TOPIC"
                  ? "bg-red-950/50 border-red-400/35 text-red-100"
                  : msg.status === "EXCELLENT"
                    ? "bg-emerald-950/45 border-emerald-400/35 text-emerald-100"
                    : "bg-amber-950/45 border-amber-400/35 text-amber-100"
                : msg.status === "OFF_TOPIC"
                  ? "bg-red-50 border-red-200 text-red-800"
                  : msg.status === "EXCELLENT"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-amber-50 border-amber-200 text-amber-900"
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
                    className={
                      d
                        ? "w-full text-left rounded-2xl px-4 py-3 bg-white/[0.06] border border-white/12 hover:bg-white/10 transition-colors group-hover:border-amber-400/40"
                        : "w-full text-left rounded-2xl px-4 py-3 bg-slate-50 border border-slate-200 hover:bg-slate-100/95 transition-colors group-hover:border-amber-400/50"
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[14px] font-medium" style={{ color: L.ink }}>
                            {s.german_text}
                          </p>
                          {s.lego_structure && (
                            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-slate-100/10 text-white/40 border border-white/10">
                              {s.lego_structure}
                            </span>
                          )}
                        </div>
                        <p className="text-[12px]" style={{ color: L.inkMuted }}>
                          {s.vietnamese_translation}
                        </p>
                      </div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white/10 text-white/60">
                        {s.level}
                      </span>
                    </div>
                  </motion.button>
                  <div className="absolute -right-1 -top-1 z-10">
                    <div className="group/info relative">
                      <button
                        type="button"
                        className="p-1.5 rounded-full bg-slate-900/90 border border-white/10 text-white/40 hover:text-amber-400 transition-colors shadow-lg"
                      >
                        <Info size={11} />
                      </button>
                      <div className="invisible group-hover/info:visible absolute bottom-full right-0 mb-2 w-64 p-4 rounded-xl bg-[#0f172a] border border-white/10 shadow-2xl z-20 backdrop-blur-md">
                        <div className="mb-3 pb-3 border-b border-white/5">
                          <p className="text-[10px] font-bold text-amber-400 uppercase mb-1">Tại sao dùng câu này?</p>
                          <p className="text-[12px] text-white/80 leading-relaxed">{s.why_to_use}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-purple-400 uppercase mb-1">Hoàn cảnh sử dụng:</p>
                          <p className="text-[12px] text-white/60 leading-relaxed">{s.usage_context}</p>
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
          <SpeakingFeedbackCompact msg={msg} isV2={isV2} dark={d} />
        )}
      </div>
    </motion.div>
  );
}
