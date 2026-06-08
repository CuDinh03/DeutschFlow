"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/stores/useChatStore";
import { StreamStatusIndicator } from "@/components/features/ai-speaking/StreamStatusIndicator";
import { SessionSummary } from "@/components/features/ai-speaking/SessionSummary";
import { SpeakingChatSidebar } from "@/components/features/ai-speaking/SpeakingChatSidebar";
import { SpeakingAdaptiveBar } from "@/components/features/ai-speaking/SpeakingAdaptiveBar";
import { SpeakingChatHeader } from "@/components/features/ai-speaking/SpeakingChatHeader";
import { SpeakingChatEmptyState } from "@/components/features/ai-speaking/SpeakingChatEmptyState";
import { SpeakingInputDock } from "@/components/features/ai-speaking/SpeakingInputDock";
import { SpeakingLearningStrip } from "@/components/features/ai-speaking/SpeakingLearningStrip";
import { SpeakingQuotaBlockedBanner } from "@/components/features/ai-speaking/SpeakingQuotaBlockedBanner";
import { MicPermissionBanner } from "@/components/features/ai-speaking/MicPermissionBanner";
import { SpeakingMessageBubble } from "@/components/speaking/SpeakingMessageBubble";
import { SPEAKING_IMMERSIVE_GRADIENT } from "@/components/speaking/types";
import ErrorRepairDrill from "@/components/errors/ErrorRepairDrill";
import { chatMessageToBubble } from "@/lib/chatMessageMapper";
import { CheckCircle } from "lucide-react";
import { useSpeech } from "@/hooks/useSpeech";
import { useSpeakingRecorderMic } from "@/hooks/useSpeakingRecorderMic";
import { aiSpeakingApi } from "@/lib/aiSpeakingApi";
import type { AiChatResponse } from "@/lib/aiSpeakingApi";
import type { RepairGateState } from "@/types/speaking-session";
import { useAiSpeakingSession } from "@/hooks/useAiSpeakingSession";
import { SpeakingMobileCopilotSheet } from "@/components/features/ai-speaking/SpeakingMobileCopilotSheet";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useTracking } from "@/hooks/useTracking";
import api from "@/lib/api";
import { SpeakingPersonaFloat } from "@/components/speaking/SpeakingPersonaFloat";
import { usePersonaReaction } from "@/hooks/usePersonaReaction";
import { useStatusBarStyle } from "@/lib/statusBar";

type ViewMode = "chat" | "summary";

// Keywords that indicate AI is ending the interview (Phase 5)
const INTERVIEW_END_KEYWORDS = [
  "vielen dank für das gespräch",
  "vielen dank für ihre zeit",
  "vielen dank für deine zeit",
  "wir melden uns",
  "wir werden uns bei ihnen melden",
  "nächsten schritte",
  "weitere schritte",
  "bedanke mich für das gespräch",
  "das war unser gespräch",
  "damit sind wir am ende",
  "das war's von meiner seite",
  "auf wiedersehen",
  "alles gute",
];

function detectInterviewEnd(text: string): boolean {
  const lower = text.toLowerCase();
  return INTERVIEW_END_KEYWORDS.some((kw) => lower.includes(kw));
}

export default function AIChatInterface() {
  useStatusBarStyle("dark");
  const router = useRouter();
  const t = useTranslations("speaking");
  const tChat = useTranslations("speaking.chat");

  const {
    selectedCompanion,
    sessionId,
    sessionMode,
    experienceLevel,
    responseSchema,
    sessionTopic,
    adaptiveMeta,
    setAdaptiveMeta,
    pendingRepairGate,
    setPendingRepairGate,
    setInterviewReportJson,
    clearChat,
  } = useChatStore();

  const [inputText, setInputText] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [showEndPopup, setShowEndPopup] = useState(false);
  const [greetingSpoken, setGreetingSpoken] = useState(false);
  const [mobileCopilotOpen, setMobileCopilotOpen] = useState(false);
  const { trackFeatureAction } = useTracking();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const suggestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reviewImportRef = useRef(false);
  const onInterviewEndedRef = useRef<(() => void) | undefined>(undefined);

  const { isSpeaking, speak, speakWithPersona, stopSpeaking } = useSpeech({
    lang: "de-DE",
  });

  const [repairGate, setRepairGate] = useState<RepairGateState>(null);

  const handleSpeak = useCallback(
    (text: string) => {
      if (selectedCompanion) {
        speakWithPersona(text, selectedCompanion.id, selectedCompanion.voiceFile);
      } else {
        speak(text);
      }
    },
    [speak, speakWithPersona, selectedCompanion],
  );

  const openAdaptiveRepairIfNeeded = useCallback((meta: AiChatResponse) => {
    if (meta.adaptive) setAdaptiveMeta(meta.adaptive);
    const a = meta.adaptive;
    if (a?.forceRepairBeforeContinue && a.primaryRepairErrorCode) {
      const err = meta.errors?.find((e) => e.errorCode === a.primaryRepairErrorCode);
      setRepairGate({
        code: a.primaryRepairErrorCode,
        exampleCorrectDe: err?.exampleCorrectDe ?? undefined,
        ruleViShort: err?.ruleViShort ?? undefined,
        blocking: true,
      });
    } else if (!a?.forceRepairBeforeContinue) {
      setRepairGate(null);
    }
  }, [setAdaptiveMeta]);

  const {
    messages,
    lastSuggestions,
    setLastSuggestions,
    quota,
    quotaBlocked,
    autoTtsEnabled,
    setAutoTts,
    sendUserText,
    retryLastSend,
    abortStream,
    streamStatus,
    trackSuggestionUsed,
    trackPhonemeEvaluated,
    trackRepairCompleted,
  } = useAiSpeakingSession({
    sessionMode,
    openAdaptiveRepairIfNeeded,
    onSpeakAi: handleSpeak,
    trackFeatureAction: (feature, action, props) =>
      trackFeatureAction(feature, action as Parameters<typeof trackFeatureAction>[1], props),
    onInterviewEnded: () => onInterviewEndedRef.current?.(),
  });

  const {
    isListening,
    isTranscribing,
    isEvaluatingPhoneme,
    phonemeResult,
    micError,
    micErrorKind,
    setMicError,
    clearPhoneme,
    toggleMic,
    cleanup: cleanupMic,
  } = useSpeakingRecorderMic(t, trackPhonemeEvaluated);

  // ─── Timer ──────────────────────────────────────────────────
  useEffect(() => {
    if (viewMode === "summary") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [viewMode]);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ─── Scroll to bottom ──────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamStatus, showSuggestions, scrollToBottom]);

  // ─── Redirect if no companion ──────────────────────────────
  useEffect(() => {
    if (!selectedCompanion) {
      router.push("/speaking");
    } else {
      trackFeatureAction('ai_speaking', 'started', { mode: sessionMode });
    }
  }, [selectedCompanion, router, sessionMode, trackFeatureAction]);

  useEffect(() => {
    if (!pendingRepairGate) return;
    setRepairGate({
      code: pendingRepairGate.code,
      exampleCorrectDe: pendingRepairGate.exampleCorrectDe,
      ruleViShort: pendingRepairGate.ruleViShort,
      blocking: true,
    });
    setPendingRepairGate(null);
  }, [pendingRepairGate, setPendingRepairGate]);

  // ─── Auto-speak greeting message ───────────────────────────
  useEffect(() => {
    if (
      !greetingSpoken &&
      selectedCompanion &&
      messages.length === 1 &&
      messages[0].role === "ai" &&
      messages[0].contentDe &&
      !messages[0].isStreaming
    ) {
      setGreetingSpoken(true);
      if (autoTtsEnabled) {
        setTimeout(() => {
          handleSpeak(messages[0].contentDe);
        }, 500);
      }
    }
  }, [messages, selectedCompanion, greetingSpoken, autoTtsEnabled, handleSpeak]);

  // ─── Smart Suggestion Timer ────────────────────────────────
  const isJunior = experienceLevel === "0-6M" || experienceLevel === "6-12M";
  const suggestionDelayMs = sessionMode === "INTERVIEW"
    ? (isJunior ? 70_000 : 10_000)
    : 10_000;

  useEffect(() => {
    if (suggestionTimerRef.current) {
      clearTimeout(suggestionTimerRef.current);
      suggestionTimerRef.current = null;
    }

    if (
      streamStatus === "idle" &&
      messages.length > 0 &&
      messages[messages.length - 1].role === "ai" &&
      !messages[messages.length - 1].isStreaming
    ) {
      setShowSuggestions(false);
      suggestionTimerRef.current = setTimeout(() => {
        setShowSuggestions(true);
      }, suggestionDelayMs);
    } else {
      setShowSuggestions(false);
    }

    return () => {
      if (suggestionTimerRef.current) clearTimeout(suggestionTimerRef.current);
    };
  }, [messages, streamStatus, suggestionDelayMs]);

  // ─── Detect interview end (Phase 5 keywords) ──────────────
  useEffect(() => {
    if (sessionMode !== "INTERVIEW" || showEndPopup) return;
    if (messages.length < 6) return; // At least a few turns before end
    const lastAi = messages.filter((m) => m.role === "ai" && !m.isStreaming);
    if (lastAi.length === 0) return;
    const lastAiMsg = lastAi[lastAi.length - 1];
    if (lastAiMsg.contentDe && detectInterviewEnd(lastAiMsg.contentDe)) {
      setShowEndPopup(true);
    }
  }, [messages, sessionMode, showEndPopup]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    if (quotaBlocked) {
      setMicError(t("errorQuota"));
      return;
    }
    if (repairGate?.blocking) {
      setMicError(t("forceRepairBanner"));
      return;
    }

    const userText = inputText.trim();
    setShowSuggestions(false);
    setMobileCopilotOpen(false);
    clearPhoneme();
    setInputText("");
    sendUserText(userText);
  };

  const importReviewErrors = async (errors: string[]) => {
    if (reviewImportRef.current || errors.length === 0) return;
    reviewImportRef.current = true;
    try {
      await api.post('/review-tasks/import', { errors });
    } catch (err) {
      console.error('Failed to import review errors', err);
    }
  };

  // ─── Handle End Session ────────────────────────────────────
  const handleEndSession = async () => {
    setShowEndPopup(false);
    abortStream();
    const sid = useChatStore.getState().sessionId;
    if (sid) {
      try {
        const res = await aiSpeakingApi.endSession(sid);
        if (res.data?.interviewReportJson) {
          setInterviewReportJson(res.data.interviewReportJson);
        }
        trackFeatureAction('ai_speaking', 'completed', { mode: sessionMode, messagesCount: messages.length });
      } catch (err) {
        console.error("Failed to end session", err);
      }
    }
    stopSpeaking();
    setViewMode("summary");
  };
  // Keep the ref in sync so the hook can call this after the farewell message
  onInterviewEndedRef.current = handleEndSession;

  // ─── Handle Suggestion Select ──────────────────────────────
  const handleSuggestionSelect = (text: string) => {
    trackSuggestionUsed(text);
    setInputText(text);
    setShowSuggestions(false);
    setMobileCopilotOpen(false);
  };

  const handleToggleMic = useCallback(() => {
    if (quotaBlocked) {
      setMicError(t("errorQuota"));
      return;
    }
    toggleMic((text) => setInputText(text));
  }, [toggleMic, quotaBlocked, setMicError, t]);

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const lastUserErrors = lastUserMessage?.errors ?? [];

  const personaReaction = usePersonaReaction({
    streamStatus,
    isListening,
    isSpeaking,
    lastUserErrors,
  });

  const openCopilot = useCallback(() => setMobileCopilotOpen(true), []);

  const suggestionCount = showSuggestions ? lastSuggestions.length : 0;
  const stripPhonemeScore = phonemeResult?.score ?? null;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (mobileCopilotOpen) {
          setMobileCopilotOpen(false);
          return;
        }
        if (isListening) {
          e.preventDefault();
          handleToggleMic();
        }
        stopSpeaking();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isListening, mobileCopilotOpen, stopSpeaking, handleToggleMic]);

  // ─── Clean up speech + stream on unmount / navigate away ──
  useEffect(() => {
    return () => {
      // Abort any running SSE stream to free Groq connection
      abortStream();
      cleanupMic();
      stopSpeaking();
      // Do NOT auto-end the speaking session here:
      // React Strict Mode and route transitions can unmount/remount this page during development,
      // which would prematurely close the session before the user finishes chatting.
      // The session is ended explicitly via the header "Kết thúc" action.
    };
  }, [abortStream, cleanupMic, stopSpeaking]);

  // These hooks MUST be called before any conditional returns to obey Rules of Hooks
  const interviewPhaseKey = useChatStore((s) => s.interviewPhaseKey);
  const interviewHintKey = useChatStore((s) => s.interviewHintKey);

  // ─── Guard: redirect if no companion (after all hooks) ─────
  if (!selectedCompanion) {
    return null;
  }

  // ─── SUMMARY VIEW ──────────────────────────────────────────
  if (viewMode === "summary") {
    return (
      <div
        data-native-page
        className="min-h-screen flex flex-col"
        style={{ background: "linear-gradient(180deg, #0A0F1E 0%, #0F172A 60%, #1A1535 100%)" }}
      >
        <div className="max-w-[460px] mx-auto w-full flex flex-col flex-1 p-4 overflow-y-auto">
          <SessionSummary
            messages={messages}
            duration={formatTime(seconds)}
            isInterviewMode={sessionMode === "INTERVIEW"}
            interviewReportJson={useChatStore.getState().interviewReportJson}
            onReviewErrors={async (errors) => {
              await importReviewErrors(errors);
              clearChat();
              router.push("/student/review");
            }}
            onViewHistory={() => {
              clearChat();
              router.push("/student/speaking-history");
            }}
            onRestart={() => {
              clearChat();
              router.push("/speaking");
            }}
            onExit={() => {
              clearChat();
              router.push("/");
            }}
          />
        </div>
      </div>
    );
  }

  const isInterview = sessionMode === "INTERVIEW";

  const personaRoleKey =
    selectedCompanion &&
    (`personaRole${selectedCompanion.id.charAt(0).toUpperCase()}${selectedCompanion.id.slice(1)}` as const);
  const personaRole =
    personaRoleKey && t.has(personaRoleKey) ? t(personaRoleKey) : selectedCompanion?.personality;

  const interviewPhaseLabel = (() => {
    if (!isInterview || !interviewPhaseKey) return null;
    const phaseI18n: Record<string, string> = {
      INTRO: "interviewPhaseIntro",
      ICE_BREAKER: "interviewPhaseIceBreaker",
      HARD_SKILLS: "interviewPhaseHardSkills",
      STAR_SOFT: "interviewPhaseStar",
      CLOSING: "interviewPhaseClosing",
    };
    const key = phaseI18n[interviewPhaseKey];
    return key && tChat.has(key) ? tChat(key) : null;
  })();

  const interviewHintLabel = (() => {
    if (!isInterview || !interviewHintKey) return null;
    const hintI18n: Record<string, string> = {
      expectConcreteExample: "interviewHintExpectConcreteExample",
      answerShorter: "interviewHintAnswerShorter",
      closingAsk: "interviewHintClosingAsk",
      closingAnswer: "interviewHintClosingAnswer",
    };
    const key = hintI18n[interviewHintKey];
    return key && tChat.has(key) ? tChat(key) : null;
  })();

  const inputTip = [
    isInterview
      ? isJunior
        ? tChat("tipInterviewJunior")
        : tChat("tipInterviewSenior")
      : tChat("tipConversation"),
    interviewHintLabel,
  ]
    .filter(Boolean)
    .join(" ");

  const headerSubtitle = [
    isInterview ? tChat("modeInterview") : tChat("modeConversation"),
    selectedCompanion.cefrLevel,
    interviewPhaseLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  // ─── CHAT VIEW (immersive dark, 2-column on desktop) ───────
  return (
    <div className="flex flex-col h-screen" style={{ background: SPEAKING_IMMERSIVE_GRADIENT }}>
      <SpeakingChatHeader
        companionId={selectedCompanion.id}
        companionName={selectedCompanion.name}
        subtitle={headerSubtitle}
        streamStatus={streamStatus}
        secondsLabel={formatTime(seconds)}
        quota={quota}
        autoTtsEnabled={autoTtsEnabled}
        onAutoTtsChange={setAutoTts}
        onBack={() => {
          trackFeatureAction("ai_speaking", "quit", { mode: sessionMode, messagesCount: messages.length });
          router.push("/speaking");
        }}
        onEnd={handleEndSession}
      />

      <SpeakingAdaptiveBar
        adaptive={adaptiveMeta}
        repairBlocking={!!repairGate?.blocking}
        personaId={selectedCompanion.id}
      />

      {quotaBlocked && (
        <div className="px-4 pt-3">
          <SpeakingQuotaBlockedBanner compact />
        </div>
      )}

      {micError && micErrorKind ? (
        <MicPermissionBanner
          message={micError}
          kind={micErrorKind}
          onRetry={handleToggleMic}
          onDismiss={() => setMicError(null)}
        />
      ) : (
        (micError || isTranscribing || isEvaluatingPhoneme) && (
          <div className="px-4 py-1.5 text-center text-xs bg-white/[0.04] border-b border-white/8">
            {micError && <span className="text-red-400">{micError}</span>}
            {!micError && isTranscribing && <span className="text-white/50">{t("transcribing")}</span>}
            {!micError && isEvaluatingPhoneme && (
              <span className="text-cyan-400/80">{tChat("phonemeAnalyzing")}</span>
            )}
          </div>
        )
      )}

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        <main className="relative flex-1 md:w-[65%] md:flex-none overflow-y-auto p-4 md:p-6 space-y-2 min-h-0">
          <SpeakingPersonaFloat
            personaId={selectedCompanion.id}
            reaction={personaReaction}
          />
          <div className="max-w-3xl mx-auto w-full">
            {messages.length === 0 && (
              <SpeakingChatEmptyState
                personaId={selectedCompanion.id}
                companionName={selectedCompanion.name}
                personaRole={personaRole}
                sessionTopic={sessionTopic}
                onStarterSelect={handleSuggestionSelect}
              />
            )}

            {messages.map((msg, index) => (
              <SpeakingMessageBubble
                key={msg.id}
                msg={chatMessageToBubble(msg, index)}
                showExplanations
                sessionResponseSchema={responseSchema}
                appearance="dark"
                personaId={selectedCompanion.id}
                interviewGhost={isInterview && msg.role === "ai"}
                onSuggestionClick={handleSuggestionSelect}
                onAiSpeak={msg.role === "ai" ? handleSpeak : undefined}
                onUserErrorsClick={msg.role === "user" && msg.errors?.length ? openCopilot : undefined}
                aiChatBusy={streamStatus === "streaming" || streamStatus === "processing"}
              />
            ))}

            <StreamStatusIndicator
              status={streamStatus}
              onRetry={streamStatus === "stalled" ? retryLastSend : undefined}
              immersive
            />

            <div ref={messagesEndRef} />
          </div>
        </main>

        <SpeakingChatSidebar
          isListening={isListening}
          inputText={inputText}
          streamStatus={streamStatus}
          isSpeaking={isSpeaking}
          showSuggestions={showSuggestions}
          suggestions={lastSuggestions}
          lastUserErrors={lastUserErrors}
          companionName={selectedCompanion.name}
          personaRole={personaRole}
          sessionTopic={sessionTopic}
          phonemeResult={phonemeResult}
          phonemeLoading={isEvaluatingPhoneme}
          onSuggestionSelect={handleSuggestionSelect}
          onStarterSelect={handleSuggestionSelect}
        />
      </div>

      {!quotaBlocked && (
        <SpeakingLearningStrip
          errorCount={lastUserErrors.length}
          phonemeScore={stripPhonemeScore}
          suggestionCount={suggestionCount}
          onOpen={openCopilot}
        />
      )}

      <SpeakingInputDock
        inputText={inputText}
        onInputChange={setInputText}
        onSubmit={() => handleSendMessage()}
        isListening={isListening}
        isTranscribing={isTranscribing}
        isEvaluatingPhoneme={isEvaluatingPhoneme}
        streamIdle={streamStatus === "idle"}
        repairBlocking={!!repairGate?.blocking}
        quotaBlocked={quotaBlocked}
        micBlocked={!!micErrorKind}
        companionName={selectedCompanion.name}
        inputTip={inputTip}
        onToggleMic={handleToggleMic}
        showSuggestionHint
      />

      <SpeakingMobileCopilotSheet
        open={mobileCopilotOpen}
        onClose={() => setMobileCopilotOpen(false)}
        showSuggestions={showSuggestions}
        suggestions={lastSuggestions}
        lastUserErrors={lastUserErrors}
        phonemeResult={phonemeResult}
        phonemeLoading={isEvaluatingPhoneme}
        onSuggestionSelect={handleSuggestionSelect}
      />

      {/* ── Interview End Popup ─────────────────────────────────── */}
      <AnimatePresence>
        {showEndPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative z-10 w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle size={32} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                  {tChat("interviewEndTitle")}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                  {tChat("interviewEndDesc", { name: selectedCompanion.name })}
                </p>
                <button
                  onClick={handleEndSession}
                  className="w-full py-3.5 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #121212, #333)", boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}
                >
                  {tChat("interviewEndButton")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ErrorRepairDrill
        open={!!repairGate}
        onClose={(passed) => {
          if (!repairGate?.blocking || passed) {
            if (passed) trackRepairCompleted();
            setRepairGate(null);
          }
        }}
        errorCode={repairGate?.code ?? ""}
        exampleCorrectDe={repairGate?.exampleCorrectDe}
        ruleViShort={repairGate?.ruleViShort}
        blocking={repairGate?.blocking}
      />

      {/* ── Shimmer Keyframes ──────────── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      ` }} />
    </div>
  );
}
