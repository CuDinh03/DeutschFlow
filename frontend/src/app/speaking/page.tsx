"use client";

/**
 * Speaking route — production wiring for AI Speaking Module.
 *
 * UIDemo mapping (khác product một phần chủ đích):
 * - `uidemo/.../Speaking.tsx` ≈ **phiên V1**: voice-first, gradient “phone”, mic strip,
 *   visualizer, tutor bubbles kiểu phiên dịch đầy đủ — mock **không** tách persona/V2.
 * - `uidemo/.../AIChat.tsx` ≈ **mặt V2 / Persona (text companion)**: nền `#080818`,
 *   `PERSONA_TOKENS` (accent/bubble/border), `CharacterFloat` + `ChatInput`,
 *   state `idle | thinking | streaming | error` — **chỉ chat chữ**, không mic session.
 *
 * Trang này gộp **cả API V1 lẫn V2** (`session.responseSchema`): cùng một shell
 * (Welcome → chat → summary), bubble/input từ `SpeakingMessageBubble` + hook thật.
 * **V2** (`responseSchema === "V2"`): nhánh **companion** — nền `#080818`, token
 * `getPersonaV2VisualTokens`, header kiểu `AIChat`, `SpeakingCharacterFloat`,
 * `SpeakingCompanionInput` (mic | nhập | gửi như UIDemo); bubble AI dùng token persona.
 * **V1**: layout “phone” + gradient + `PersonaAvatar` (luồng gần `Speaking.tsx` demo).
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Square, Loader2, ChevronLeft, ArrowLeft, Clock, Zap } from "lucide-react";
import {
  aiSpeakingApi,
  AiSpeakingSession,
  type SpeakingPersonaId,
  type SpeakingResponseSchemaId,
} from "@/lib/aiSpeakingApi";
import { mapResponseToBubble, useSpeakingChat } from "@/hooks/useSpeakingChat";
import ErrorRepairDrill from "@/components/errors/ErrorRepairDrill";
import { speakGerman } from "@/lib/speechDe";
import api, { apiMessage, httpStatus } from "@/lib/api";
import { toastApiError } from "@/lib/toastApiError";
import { getAccessToken, clearTokens } from "@/lib/authSession";
import { SessionState, glass, CYAN, SPEAKING_IMMERSIVE_GRADIENT, SPEAKING_PHONE_PANEL_BG } from "@/components/speaking/types";
import { SpeakingVoiceVisualizer, type SpeakingVizState } from "@/components/speaking/SpeakingVoiceVisualizer";
import { MicButton } from "@/components/speaking/MicButton";
import { SpeakingMessageBubble } from "@/components/speaking/SpeakingMessageBubble";
import { SpeakingAmbientOrbs } from "@/components/speaking/SpeakingAmbientOrbs";
import { PersonaAvatar } from "@/components/speaking/PersonaAvatar";
import { SpeakingMessageInput } from "@/components/speaking/SpeakingMessageInput";
import { cn } from "@/lib/utils";
import {
  getPersonaV2VisualTokens,
  normalizeSpeakingPersona,
  personaRingClass,
} from "@/components/speaking/personaTheme";
import { SpeakingCharacterFloat } from "@/components/speaking/SpeakingCharacterFloat";
import { SpeakingCompanionInput } from "@/components/speaking/SpeakingCompanionInput";
import { SpeakingPersonaMiniAvatar } from "@/components/speaking/SpeakingPersonaMiniAvatar";
import { SessionSummary } from "@/components/speaking/SessionSummary";
import { WelcomeScreen } from "@/components/speaking/WelcomeScreen";
import { StudentShell } from "@/components/layouts/StudentShell";

const SHOW_EXPLANATIONS_KEY = "df_speaking_showExplanations";

const SUGGESTION_REVEAL_DELAY_MS = 10_000;

function formatSessionClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function SpeakingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("speaking");
  const deeplinkTopic = (searchParams.get("topic") ?? "").trim();
  const deeplinkCefr = (searchParams.get("cefr") ?? "").trim();

  const [me, setMe] = useState<{ displayName: string; role: string } | null>(null);
  const [targetLevel, setTargetLevel] = useState("A1");
  const [streakDays, setStreakDays] = useState(0);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    (async () => {
      try {
        const [meRes, planRes, dashRes] = await Promise.all([
          api.get("/auth/me"),
          api.get<{ plan?: { targetLevel?: string } }>("/plan/me").catch(() => null),
          api.get<{ streakDays?: number }>("/student/dashboard").catch(() => null),
        ]);
        setMe(meRes.data);
        setTargetLevel(planRes?.data?.plan?.targetLevel ?? "A1");
        setStreakDays(Number(dashRes?.data?.streakDays ?? 0));
      } catch (err) {
        console.error("SpeakingPage: User fetch failed", err);
      }
    })();
  }, [router]);

  const [session, setSession] = useState<AiSpeakingSession | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [inputText, setInputText] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [welcomeError, setWelcomeError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [showExplanations, setShowExplanations] = useState(true);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const [revealSuggestionForMsgId, setRevealSuggestionForMsgId] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    realMessages,
    setRealMessages,
    error: chatError,
    chatNotice,
    endingSession,
    isSending,
    isTranscribing,
    repairGate,
    handleSendMessage,
    handleEndSession,
    handleStartRecord: recordMic,
    handleStopRecord,
    seedInitialAssistant,
    closeRepairGate,
    openRepairFromChip,
    pendingAdaptiveRepairMsgId,
    resetForNewSession,
  } = useSpeakingChat({
    session,
    sessionState,
    setSessionState,
    inputText,
    setInputText,
    t,
    onRecordingStopped: () => setAnalyser(null),
  });

  const chatRef = useRef<HTMLDivElement>(null);
  const suggestionRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const micUsedDuringSuggestionWindowRef = useRef(false);

  const lastAssistant = useMemo(() => {
    for (let i = realMessages.length - 1; i >= 0; i--) {
      if (realMessages[i].role === "ASSISTANT") return realMessages[i];
    }
    return null;
  }, [realMessages]);

  const renderedMessages = useMemo(() => {
    return realMessages.map((m) => {
      if (
        m.role !== "ASSISTANT" ||
        !m.suggestions?.length ||
        !lastAssistant ||
        m.id !== lastAssistant.id
      ) {
        return m;
      }
      if (revealSuggestionForMsgId !== m.id) {
        return { ...m, suggestions: undefined };
      }
      return m;
    });
  }, [realMessages, lastAssistant, revealSuggestionForMsgId]);

  useEffect(() => {
    if (sessionState !== "chatting") return;
    if (suggestionRevealTimerRef.current) {
      clearTimeout(suggestionRevealTimerRef.current);
      suggestionRevealTimerRef.current = null;
    }
    setRevealSuggestionForMsgId(null);
    micUsedDuringSuggestionWindowRef.current = false;

    const last = realMessages[realMessages.length - 1];
    if (!last || last.role !== "ASSISTANT" || !last.suggestions?.length) return;

    const targetId = last.id;
    suggestionRevealTimerRef.current = setTimeout(() => {
      if (!micUsedDuringSuggestionWindowRef.current) {
        setRevealSuggestionForMsgId(targetId);
      }
      suggestionRevealTimerRef.current = null;
    }, SUGGESTION_REVEAL_DELAY_MS);

    return () => {
      if (suggestionRevealTimerRef.current) {
        clearTimeout(suggestionRevealTimerRef.current);
        suggestionRevealTimerRef.current = null;
      }
    };
  }, [realMessages, sessionState]);

  useEffect(() => {
    if (sessionState !== "chatting") return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [sessionState]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SHOW_EXPLANATIONS_KEY);
      if (stored !== null) setShowExplanations(stored === "true");
    } catch { }
  }, []);

  const personaTitleKey = useMemo(() => {
    const id = String(session?.persona ?? "DEFAULT").toUpperCase();
    const map: Record<
      string,
      | "personaNameDefault"
      | "personaNameLukas"
      | "personaNameEmma"
      | "personaNameHanna"
      | "personaNameKlaus"
    > = {
      DEFAULT: "personaNameDefault",
      LUKAS: "personaNameLukas",
      EMMA: "personaNameEmma",
      HANNA: "personaNameHanna",
      KLAUS: "personaNameKlaus",
    };
    return map[id] ?? "personaNameDefault";
  }, [session?.persona]);

  const personaChatNameKey = useMemo(() => {
    const id = String(session?.persona ?? "DEFAULT").toUpperCase();
    const map: Record<
      string,
      | "personaChatNameDefault"
      | "personaChatNameLukas"
      | "personaChatNameEmma"
      | "personaChatNameHanna"
      | "personaChatNameKlaus"
    > = {
      DEFAULT: "personaChatNameDefault",
      LUKAS: "personaChatNameLukas",
      EMMA: "personaChatNameEmma",
      HANNA: "personaChatNameHanna",
      KLAUS: "personaChatNameKlaus",
    };
    return map[id] ?? "personaChatNameDefault";
  }, [session?.persona]);

  const personaRoleKey = useMemo(() => {
    const id = String(session?.persona ?? "DEFAULT").toUpperCase();
    const map: Record<
      string,
      | "personaRoleDefault"
      | "personaRoleLukas"
      | "personaRoleEmma"
      | "personaRoleHanna"
      | "personaRoleKlaus"
    > = {
      DEFAULT: "personaRoleDefault",
      LUKAS: "personaRoleLukas",
      EMMA: "personaRoleEmma",
      HANNA: "personaRoleHanna",
      KLAUS: "personaRoleKlaus",
    };
    return map[id] ?? "personaRoleDefault";
  }, [session?.persona]);

  const { assistantPerfect, assistantTotal } = useMemo(() => {
    const assistants = realMessages.filter((m) => m.role === "ASSISTANT");
    const total = assistants.length;
    const withIssues = assistants.filter(
      (m) => (m.errors?.length ?? 0) > 0 || !!m.correction,
    ).length;
    return { assistantPerfect: total - withIssues, assistantTotal: total };
  }, [realMessages]);

  const vizState: SpeakingVizState = useMemo(() => {
    if (analyser) return "listening";
    if (isSending || isTranscribing) return "processing";
    return "idle";
  }, [analyser, isSending, isTranscribing]);

  const micUiState: SessionState = useMemo(() => {
    if (isSending) return "sending";
    if (isTranscribing) return "processing";
    if (analyser) return "listening";
    return "chatting";
  }, [isSending, isTranscribing, analyser]);

  useEffect(() => {
    if (sessionState !== "chatting") return;
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [realMessages, sessionState, lastAssistant?.isStreaming, lastAssistant?.aiSpeechDe]);

  const suppressSuggestionsIfStillPendingReveal = () => {
    if (
      lastAssistant?.suggestions?.length &&
      revealSuggestionForMsgId === lastAssistant.id
    ) {
      return;
    }
    micUsedDuringSuggestionWindowRef.current = true;
    if (suggestionRevealTimerRef.current) {
      clearTimeout(suggestionRevealTimerRef.current);
      suggestionRevealTimerRef.current = null;
    }
    setRevealSuggestionForMsgId(null);
  };

  const handleStartSession = async (
    topic?: string,
    cefr?: string,
    persona?: SpeakingPersonaId,
    responseSchema?: SpeakingResponseSchemaId,
  ) => {
    setIsStarting(true);
    setWelcomeError(null);
    const resolvedCefr = (cefr?.trim() || deeplinkCefr || targetLevel || "A1").trim();
    try {
      const { data } = await aiSpeakingApi.createSession(
        topic?.trim() || undefined,
        resolvedCefr,
        persona,
        responseSchema,
      );
      resetForNewSession();
      setSession(data);
      setSessionState("chatting");
      setSeconds(0);

      if (data.initialAiMessage) {
        const aiMsg = mapResponseToBubble(data.initialAiMessage);
        setRealMessages([aiMsg]);
        if (aiMsg.aiSpeechDe) speakGerman(aiMsg.aiSpeechDe);
        seedInitialAssistant(data.initialAiMessage);
      }
    } catch (err: unknown) {
      const msg = apiMessage(err);
      setWelcomeError(msg);
      if (httpStatus(err) === 429) {
        toastApiError(err, { locale });
      }
    } finally {
      setIsStarting(false);
    }
  };

  const handleStartRecord = async () => {
    suppressSuggestionsIfStillPendingReveal();
    const r = await recordMic();
    if (r) setAnalyser(r.analyser);
  };

  const onStopRecord = () => {
    handleStopRecord();
  };

  const initials = useMemo(() => {
    return (me?.displayName ?? "U")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [me]);

  const showTypingRow = isSending && !lastAssistant?.isStreaming;

  const responseSchemaIsV2 = (session?.responseSchema as string) === "V2";
  const v2Visual = useMemo(
    () => getPersonaV2VisualTokens(normalizeSpeakingPersona(session?.persona)),
    [session?.persona],
  );
  const [v2CharEntered, setV2CharEntered] = useState(false);

  useEffect(() => {
    if (sessionState !== "chatting" || !responseSchemaIsV2) {
      setV2CharEntered(false);
      return;
    }
    const tid = window.setTimeout(() => setV2CharEntered(true), 300);
    return () => clearTimeout(tid);
  }, [sessionState, responseSchemaIsV2]);

  const v2PrimarySubtitle = useMemo(() => {
    if (lastAssistant?.isStreaming) return t("recorder.aiSpeaking");
    if (isSending) return t("recorder.processing");
    if (isTranscribing) return t("transcribing");
    if (vizState === "listening") return t("statusListening");
    return t(personaRoleKey);
  }, [
    lastAssistant?.isStreaming,
    isSending,
    isTranscribing,
    vizState,
    t,
    personaRoleKey,
  ]);

  if (!me) return null;

  const showV2CompanionChrome =
    sessionState === "chatting" && !!session && responseSchemaIsV2;

  return (
    <StudentShell
      activeSection="speaking"
      user={me}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={() => { clearTokens(); router.push("/login"); }}
      headerTitle={t("title")}
      headerRight={undefined}
      hideAppHeader={showV2CompanionChrome}
    >
      <div
        className={`h-full flex flex-col overflow-hidden relative min-h-0 ${
          sessionState === "idle"
            ? "rounded-[24px] bg-[#F8FAFF] border border-[#E2E8F0] shadow-sm"
            : showV2CompanionChrome
              ? "rounded-none border-0 shadow-none"
              : "rounded-[24px] border border-white/[0.08] shadow-[0_32px_80px_rgba(0,0,0,0.35)]"
        }`}
        data-persona={
          session
            ? normalizeSpeakingPersona(session.persona) === "LUKAS"
              ? "lukas"
              : normalizeSpeakingPersona(session.persona) === "EMMA"
                ? "emma"
                : normalizeSpeakingPersona(session.persona) === "HANNA"
                  ? "hanna"
                  : normalizeSpeakingPersona(session.persona) === "KLAUS"
                    ? "klaus"
                    : "default"
            : undefined
        }
        style={
          sessionState !== "idle"
            ? {
                background:
                  sessionState === "chatting" && session && responseSchemaIsV2
                    ? "#080818"
                    : SPEAKING_IMMERSIVE_GRADIENT,
              }
            : undefined
        }
      >
        {sessionState !== "idle" &&
          session &&
          !(sessionState === "chatting" && responseSchemaIsV2) && <SpeakingAmbientOrbs />}
        <div className="flex-1 overflow-hidden relative z-10 min-h-0 flex flex-col">
          <AnimatePresence mode="wait">
            {sessionState === "idle" && (
              <div key="welcome" className="h-full flex flex-col">
                {welcomeError ? (
                  <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {welcomeError}
                  </div>
                ) : null}
                <WelcomeScreen
                  onStart={handleStartSession}
                  isStarting={isStarting}
                  initialTopic={deeplinkTopic || undefined}
                  initialCefr={deeplinkCefr || undefined}
                  planCurrentLevel={null}
                  planTargetLevel={targetLevel}
                />
              </div>
            )}

            {sessionState === "chatting" && session && !responseSchemaIsV2 && (
              <div className="relative flex h-full min-h-0 w-full flex-1 flex-col font-sans">
                <div
                  className={cn(
                    "relative z-20 mx-auto flex h-full min-h-0 w-full max-w-[430px] flex-col overflow-hidden rounded-none sm:rounded-[40px]",
                    "border border-white/[0.07] shadow-[0_32px_80px_rgba(0,0,0,0.5)] backdrop-blur-[40px]",
                    personaRingClass(normalizeSpeakingPersona(session.persona)),
                  )}
                  style={{ background: SPEAKING_PHONE_PANEL_BG }}
                >
                  <div
                    className="flex flex-shrink-0 items-center justify-between gap-2 px-4 pb-3 pt-4"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <motion.button
                      type="button"
                      onClick={() => router.push("/dashboard")}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.97 }}
                      className="flex items-center gap-1 rounded-[10px] px-1.5 py-1.5 -ml-1 transition-colors"
                      style={{ color: "rgba(255,255,255,0.5)" }}
                    >
                      <ChevronLeft size={18} aria-hidden />
                      <span className="hidden text-xs font-medium sm:inline">{t("back")}</span>
                    </motion.button>
                    <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
                      <span
                        className="max-w-[7rem] truncate rounded-full px-2.5 py-1 text-[11px] font-bold sm:max-w-[9rem]"
                        style={{
                          background: `linear-gradient(135deg, ${CYAN}28, rgba(167,139,250,0.22))`,
                          border: `1px solid rgba(34,211,238,0.35)`,
                          color: CYAN,
                        }}
                        title={session.cefrLevel ?? ""}
                      >
                        {session.cefrLevel ?? "—"}
                      </span>
                      <div
                        className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                      >
                        <Clock size={11} style={{ color: "rgba(255,255,255,0.45)" }} aria-hidden />
                        <span
                          className="font-mono text-xs font-bold tabular-nums tracking-widest"
                          style={{ color: "rgba(255,255,255,0.9)" }}
                        >
                          {formatSessionClock(seconds)}
                        </span>
                      </div>
                    </div>
                    <div className="flex min-w-[4.5rem] flex-col items-end gap-0.5">
                      <span
                        className="max-w-[5.5rem] truncate text-right text-[10px] font-semibold"
                        style={{ color: "rgba(255,255,255,0.65)" }}
                        title={t(personaTitleKey)}
                      >
                        {t(personaTitleKey)}
                      </span>
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[9px] font-bold"
                        style={{
                          background: "rgba(255,255,255,0.08)",
                          color: "rgba(255,255,255,0.55)",
                          border: "1px solid rgba(255,255,255,0.12)",
                        }}
                      >
                        {(session.responseSchema as string) === "V2" ? "V2" : "V1"}
                      </span>
                    </div>
                  </div>

                  <div
                    ref={chatRef}
                    className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4"
                    style={{ scrollbarWidth: "thin" }}
                  >
                    <LayoutGroup>
                      <AnimatePresence initial={false} mode="popLayout">
                        {renderedMessages.map((m) => (
                          <SpeakingMessageBubble
                            key={m.id}
                            msg={m}
                            appearance="dark"
                            personaId={session.persona}
                            showExplanations={showExplanations}
                            sessionResponseSchema={
                              (session.responseSchema as SpeakingResponseSchemaId | undefined) ?? "V1"
                            }
                            onSuggestionClick={(txt) => void handleSendMessage(txt)}
                            onCorrect={(code, correct, rule) =>
                              openRepairFromChip(code, correct, rule)
                            }
                          />
                        ))}
                      </AnimatePresence>
                    </LayoutGroup>
                  {showTypingRow && (
                    <motion.div
                      className="flex items-center gap-2.5"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                        style={{ background: `linear-gradient(145deg, ${CYAN}, #A78BFA)` }}
                      >
                        🤖
                      </div>
                      <div
                        className="rounded-[14px] rounded-tl-[4px] px-4 py-3 flex items-center gap-1.5"
                        style={{ background: "rgba(34,211,238,0.09)", border: "1px solid rgba(34,211,238,0.22)" }}
                      >
                        {[0, 0.2, 0.4].map((d) => (
                          <motion.div
                            key={d}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: CYAN }}
                            animate={{ y: [0, -5, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: d }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>

                <div
                  className="flex-shrink-0 px-4 pb-4 pt-2"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                >
                  {chatError ? (
                    <div
                      className="mb-3 rounded-xl border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs text-red-100"
                      role="alert"
                    >
                      {chatError}
                    </div>
                  ) : null}
                  {chatNotice ? (
                    <div
                      className="mb-3 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-50"
                      role="status"
                    >
                      {chatNotice}
                    </div>
                  ) : null}
                  {pendingAdaptiveRepairMsgId !== null ? (
                    <div
                      className="mb-3 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
                      role="status"
                    >
                      {t("forceRepairBanner")}
                    </div>
                  ) : null}

                  <div className="rounded-[20px] p-5 mb-3 flex flex-col items-center gap-1" style={glass}>
                    <SpeakingVoiceVisualizer state={vizState} />
                    <AnimatePresence mode="wait">
                      {vizState === "idle" && session.topic && (
                        <motion.div
                          key="topic"
                          className="mt-3 rounded-[12px] px-4 py-2.5 text-center max-w-[300px]"
                          style={{
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                        >
                          <p className="text-xs leading-snug" style={{ color: "rgba(255,255,255,0.55)" }}>
                            <span style={{ color: CYAN }}>{t("topicLabel")}:</span> {session.topic}
                          </p>
                        </motion.div>
                      )}
                      {vizState === "listening" && (
                        <motion.p
                          key="listen"
                          className="text-xs mt-3 font-semibold"
                          style={{ color: "#F87171" }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [1, 0.5, 1] }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                        >
                          {t("statusListening")}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex items-center justify-between px-1 gap-2 mb-3">
                    <button
                      type="button"
                      disabled={endingSession}
                      onClick={() => void handleEndSession()}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-[12px] text-sm font-medium transition-colors disabled:opacity-50 flex-shrink-0"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        color: "rgba(255,255,255,0.65)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      {endingSession ? (
                        <Loader2 size={14} className="animate-spin" aria-hidden />
                      ) : (
                        <Square size={13} fill="currentColor" aria-hidden />
                      )}
                      <span className="hidden sm:inline">{t("endButton")}</span>
                    </button>

                    <MicButton
                      state={micUiState}
                      onToggle={() => {
                        if (analyser) onStopRecord();
                        else void handleStartRecord();
                      }}
                    />

                    <div
                      className="flex items-center gap-1.5 px-3 py-2 rounded-[12px] text-sm font-medium flex-shrink-0"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        color: "rgba(255,255,255,0.55)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                      title={t("summaryPerfect")}
                    >
                      <Zap size={13} style={{ color: CYAN }} aria-hidden />
                      <span className="text-xs font-mono tabular-nums" style={{ color: CYAN }}>
                        {assistantPerfect}/{assistantTotal}
                      </span>
                    </div>
                  </div>

                  <p className="text-center text-[10px] mb-3" style={{ color: "rgba(255,255,255,0.28)" }}>
                    {vizState === "listening"
                      ? t("statusListeningStop")
                      : vizState === "processing"
                        ? isTranscribing
                          ? t("transcribing")
                          : t("statusProcessing")
                        : t("statusIdle")}
                  </p>

                  <SpeakingMessageInput
                    inputRef={inputRef}
                    value={inputText}
                    onChange={setInputText}
                    onSend={() => void handleSendMessage()}
                    placeholder={t("placeholder")}
                    disabled={isSending}
                    personaId={session.persona}
                    sendLabel={t("placeholder")}
                  />
                </div>
                </div>

                <PersonaAvatar
                  personaId={session.persona}
                  isTalking={
                    isSending || isTranscribing || !!lastAssistant?.isStreaming
                  }
                  className="absolute bottom-[4.5rem] right-1 z-[15] sm:bottom-24 sm:right-3"
                />
              </div>
            )}

            {sessionState === "chatting" && session && responseSchemaIsV2 && (
              <div className="relative flex h-full min-h-0 w-full flex-1 flex-col bg-[#080818] font-sans text-white">
                <div className="relative mx-auto flex h-full min-h-0 w-full max-w-[430px] flex-1 flex-col">
                  <div
                    className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full opacity-[0.28]"
                    style={{ background: v2Visual.glow, filter: "blur(60px)" }}
                    aria-hidden
                  />

                  <motion.div
                    className="relative z-30 flex flex-shrink-0 items-center gap-3 px-4 pb-4 pt-[max(3rem,env(safe-area-inset-top,0px))]"
                    style={{
                      background: "rgba(8,8,24,0.95)",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <motion.button
                      type="button"
                      onClick={() => router.push("/dashboard")}
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                      style={{ background: "rgba(255,255,255,0.07)" }}
                      whileTap={{ scale: 0.88 }}
                      aria-label={t("back")}
                    >
                      <ArrowLeft size={18} style={{ color: "rgba(255,255,255,0.7)" }} aria-hidden />
                    </motion.button>

                    <div className="relative h-10 w-10 flex-shrink-0">
                      <div
                        className="box-border h-10 w-10 overflow-hidden rounded-full bg-white/[0.06]"
                        style={{ border: `2px solid ${v2Visual.accent}` }}
                      >
                        <SpeakingPersonaMiniAvatar
                          className="h-full w-full"
                          personaId={session.persona}
                          chatBusy={isSending || isTranscribing || !!lastAssistant?.isStreaming}
                        />
                      </div>
                      <span
                        className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#080818]"
                        style={{ background: "#27AE60" }}
                        aria-hidden
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-white">{t(personaChatNameKey)}</p>
                      <p className="truncate text-[11px]" style={{ color: v2Visual.accent }}>
                        {v2PrimarySubtitle}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-white/45">
                        <span className="font-bold" style={{ color: v2Visual.accent }}>
                          {session.cefrLevel ?? "—"}
                        </span>
                        <span className="text-white/35">·</span>
                        <span className="flex items-center gap-0.5 font-mono tabular-nums">
                          <Clock size={11} className="text-white/35" aria-hidden />
                          {formatSessionClock(seconds)}
                        </span>
                        <span className="text-white/35">·</span>
                        <span>V2</span>
                        <span className="text-white/35">·</span>
                        <span className="flex items-center gap-0.5">
                          <Zap size={10} style={{ color: v2Visual.accent }} aria-hidden />
                          <span className="font-mono tabular-nums" style={{ color: v2Visual.accent }}>
                            {assistantPerfect}/{assistantTotal}
                          </span>
                        </span>
                      </div>
                    </div>

                    <motion.button
                      type="button"
                      className="flex h-9 min-w-0 max-w-[42%] flex-shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 sm:max-w-none sm:px-3"
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        border: `1px solid ${v2Visual.accent}55`,
                        color: "rgba(255,255,255,0.92)",
                      }}
                      whileTap={{ scale: 0.96 }}
                      disabled={endingSession}
                      onClick={() => void handleEndSession()}
                      aria-label={t("companionHeaderEndAria")}
                    >
                      {endingSession ? (
                        <Loader2 size={14} className="animate-spin flex-shrink-0 opacity-80" aria-hidden />
                      ) : (
                        <Square size={12} className="flex-shrink-0 opacity-90" fill="currentColor" aria-hidden />
                      )}
                      <span className="truncate text-[11px] font-semibold sm:text-xs">{t("endButton")}</span>
                    </motion.button>
                  </motion.div>

                  <div className="relative min-h-0 flex-1 overflow-hidden">
                    <SpeakingCharacterFloat
                      personaId={normalizeSpeakingPersona(session.persona)}
                      isTalking={isSending || isTranscribing || !!lastAssistant?.isStreaming}
                      entered={v2CharEntered}
                      glow={v2Visual.glow}
                    />
                    <div
                      ref={chatRef}
                      className="absolute inset-0 z-10 space-y-5 overflow-y-auto px-4 pb-36 pt-4"
                      style={{ scrollbarWidth: "thin" }}
                    >
                      <LayoutGroup>
                        <AnimatePresence initial={false} mode="popLayout">
                          {renderedMessages.map((m) => (
                            <SpeakingMessageBubble
                              key={m.id}
                              msg={m}
                              appearance="dark"
                              personaId={session.persona}
                              personaV2Tokens={v2Visual}
                              showExplanations={showExplanations}
                              sessionResponseSchema={
                                (session.responseSchema as SpeakingResponseSchemaId | undefined) ?? "V2"
                              }
                              onSuggestionClick={(txt) => void handleSendMessage(txt)}
                              onCorrect={(code, correct, rule) =>
                                openRepairFromChip(code, correct, rule)
                              }
                            />
                          ))}
                        </AnimatePresence>
                      </LayoutGroup>
                      {showTypingRow && (
                        <motion.div
                          className="flex items-center gap-2.5"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-full text-sm"
                            style={{
                              background: `linear-gradient(145deg, ${v2Visual.accent}, #A78BFA)`,
                            }}
                          >
                            🤖
                          </div>
                          <div
                            className="flex items-center gap-1.5 rounded-[14px] rounded-tl-[4px] px-4 py-3"
                            style={{
                              background: `${v2Visual.accent}14`,
                              border: `1px solid ${v2Visual.accent}38`,
                            }}
                          >
                            {[0, 0.2, 0.4].map((d) => (
                              <motion.div
                                key={d}
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: v2Visual.accent }}
                                animate={{ y: [0, -5, 0] }}
                                transition={{ duration: 0.6, repeat: Infinity, delay: d }}
                              />
                            ))}
                          </div>
                        </motion.div>
                      )}
                      <div className="h-40 shrink-0" aria-hidden />
                    </div>
                  </div>

                  <div className="relative z-30 mt-auto flex-shrink-0">
                    {chatError ? (
                      <div
                        className="mx-4 mb-2 rounded-xl border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs text-red-100"
                        role="alert"
                      >
                        {chatError}
                      </div>
                    ) : null}
                    {chatNotice ? (
                      <div
                        className="mx-4 mb-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-50"
                        role="status"
                      >
                        {chatNotice}
                      </div>
                    ) : null}
                    {pendingAdaptiveRepairMsgId !== null ? (
                      <div
                        className="mx-4 mb-2 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
                        role="status"
                      >
                        {t("forceRepairBanner")}
                      </div>
                    ) : null}

                    <motion.div
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25, duration: 0.4 }}
                      style={{ zIndex: 30 }}
                    >
                      <SpeakingCompanionInput
                        inputRef={inputRef}
                        value={inputText}
                        onChange={setInputText}
                        onSend={() => void handleSendMessage()}
                        placeholder={t("companionWriteTo", {
                          name: t(personaChatNameKey),
                        })}
                        disabled={isSending}
                        sendLabel={t("placeholder")}
                        accent={v2Visual.accent}
                        glow={v2Visual.glow}
                        isAssistantSpeaking={!!lastAssistant?.isStreaming}
                        onMicToggle={() => {
                          if (analyser) onStopRecord();
                          else void handleStartRecord();
                        }}
                        micDisabled={
                          endingSession ||
                          isSending ||
                          isTranscribing ||
                          !!lastAssistant?.isStreaming
                        }
                        isListening={!!analyser}
                      />
                    </motion.div>
                  </div>
                </div>
              </div>
            )}

            {sessionState === "summary" && session && (
              <div
                key="summary-wrap"
                className="relative z-10 flex h-full min-h-0 flex-1 flex-col items-center px-2 py-4 sm:px-4"
              >
                <div
                  className={cn(
                    "flex h-full min-h-0 w-full max-w-[430px] flex-1 flex-col overflow-hidden rounded-none border border-white/[0.07] shadow-[0_32px_80px_rgba(0,0,0,0.5)] backdrop-blur-[40px] sm:rounded-[40px]",
                    personaRingClass(normalizeSpeakingPersona(session.persona)),
                  )}
                  style={{ background: SPEAKING_PHONE_PANEL_BG }}
                >
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                    <SessionSummary
                      realMessages={realMessages}
                      mockExchanges={[]}
                      duration={formatSessionClock(seconds)}
                      variant="dark"
                      onRestart={() => {
                        resetForNewSession();
                        setSession(null);
                        setSessionState("idle");
                      }}
                      onExit={() => router.push("/dashboard")}
                    />
                  </div>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {repairGate && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
            <ErrorRepairDrill
              open
              onClose={closeRepairGate}
              errorCode={repairGate.code}
              exampleCorrectDe={repairGate.exampleCorrectDe || ""}
              ruleViShort={repairGate.ruleViShort || ""}
              blocking={!!repairGate.blocking}
            />
          </div>
        )}
      </AnimatePresence>
    </StudentShell>
  );
}
