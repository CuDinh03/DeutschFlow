"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Lightbulb, Mic, AlertCircle } from "lucide-react";
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
  onSuggestionSelect: (text: string) => void;
  onStarterSelect: (text: string) => void;
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
  onSuggestionSelect,
  onStarterSelect,
}: Props) {
  const t = useTranslations("speaking.chat");
  const viz = vizState(isListening, streamStatus, isSpeaking);

  const showRecordingPanel = isListening || viz !== "idle";
  const showComposing = !isListening && !!inputText.trim();
  const showSuggestionPanel = showSuggestions && suggestions.length > 0;
  const showCorrections = lastUserErrors.length > 0;
  const showPhoneme = !!phonemeResult || phonemeLoading;
  const showEmpty =
    !showRecordingPanel &&
    !showComposing &&
    !showSuggestionPanel &&
    !showCorrections &&
    !showPhoneme;

  const starters = [
    t("starter1"),
    t("starter2"),
    t("starter3"),
  ] as const;

  return (
    <aside
      id="speaking-copilot-panel"
      className="ga-ui hidden md:flex md:w-[35%] flex-col border-l border-ga-line bg-ga-card overflow-y-auto"
    >
      <div className="p-4 space-y-4 flex-1">
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
          </div>
        )}
      </div>
    </aside>
  );
}
