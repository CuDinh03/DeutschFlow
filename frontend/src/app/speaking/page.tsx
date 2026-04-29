"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ChevronLeft, Settings, Zap, Clock, AlertTriangle, Send, X, Eye, EyeOff,
} from "lucide-react";
import { aiSpeakingApi, chatStream, AiSpeakingSession, AiChatResponse } from "@/lib/aiSpeakingApi";
import { speakGerman, primeGermanVoices } from "@/lib/speechDe";
import { startRecorder, RecorderHandle } from "@/lib/voiceRecorder";
import {
  SessionState, AiMessageBubble, Exchange,
  CYAN, PURPLE, glass,
} from "@/components/speaking/types";
import { VoiceVisualizer } from "@/components/speaking/VoiceVisualizer";
import { MicButton } from "@/components/speaking/MicButton";
import { RealChatBubble } from "@/components/speaking/RealChatBubble";
import { SessionSummary } from "@/components/speaking/SessionSummary";
import { WelcomeScreen } from "@/components/speaking/WelcomeScreen";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const SHOW_EXPLANATIONS_KEY = "df_speaking_showExplanations";

export default function SpeakingPage() {
  const router = useRouter();
  const t = useTranslations("speaking");

  // Session
  const [session,      setSession]      = useState<AiSpeakingSession | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [realMessages, setRealMessages] = useState<AiMessageBubble[]>([]);
  const [mockExchanges]                 = useState<Exchange[]>([]);

  // Text input
  const [inputText,  setInputText]  = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Timer
  const [seconds, setSeconds] = useState(0);

  // Explanation toggle (persisted)
  const [showExplanations, setShowExplanations] = useState(true);

  // Live analyser for real-time waveform
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const chatRef      = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLTextAreaElement>(null);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorderRef  = useRef<RecorderHandle | null>(null);
  const streamCtrl   = useRef<AbortController | null>(null);

  // Load persisted explanation toggle
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SHOW_EXPLANATIONS_KEY);
      if (stored !== null) setShowExplanations(stored === "true");
    } catch { /* SSR guard */ }
  }, []);

  const toggleExplanations = () => {
    setShowExplanations((prev) => {
      const next = !prev;
      try { localStorage.setItem(SHOW_EXPLANATIONS_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  useEffect(() => { primeGermanVoices(); }, []);

  useEffect(() => {
    if (!session || sessionState === "summary") {
      clearInterval(timerRef.current!);
      return;
    }
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timerRef.current!);
  }, [session, sessionState]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [realMessages, sessionState]);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── Start session ─────────────────────────────────────────────────────────────
  const handleStartSession = useCallback(async (topic?: string, cefrLevel?: string) => {
    setIsStarting(true);
    setError(null);
    try {
      const res = await aiSpeakingApi.createSession(topic, cefrLevel);
      setSession(res.data);
      setRealMessages([]);
      setSeconds(0);
      setSessionState("idle");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? t("errorStart"));
    } finally {
      setIsStarting(false);
    }
  }, [t]);

  // ── Streaming send ─────────────────────────────────────────────────────────────
  const handleSendText = useCallback((overrideText?: string) => {
    const text = (overrideText ?? inputText).trim();
    if (!session || !text || sessionState === "sending" || sessionState === "processing") return;
    setInputText("");
    setSessionState("sending");
    setError(null);

    const tempUserId = Date.now();
    setRealMessages((prev) => [...prev, { id: tempUserId, role: "USER", userText: text }]);

    // Create a placeholder ASSISTANT bubble for ghost text
    const tempAiId = tempUserId + 1;
    setRealMessages((prev) => [
      ...prev,
      { id: tempAiId, role: "ASSISTANT", aiSpeechDe: "", isStreaming: true },
    ]);

    streamCtrl.current?.abort();
    streamCtrl.current = chatStream(
      session.id,
      text,
      (delta) => {
        // Append token to the streaming bubble
        setRealMessages((prev) =>
          prev.map((m) =>
            m.id === tempAiId
              ? { ...m, aiSpeechDe: (m.aiSpeechDe ?? "") + delta }
              : m
          )
        );
      },
      (meta: AiChatResponse) => {
        // Replace temp bubble with final data
        setRealMessages((prev) =>
          prev.map((m) =>
            m.id === tempAiId
              ? {
                  id: meta.messageId,
                  role: "ASSISTANT",
                  aiSpeechDe: meta.aiSpeechDe,
                  correction: meta.correction,
                  explanationVi: meta.explanationVi,
                  grammarPoint: meta.grammarPoint,
                  newWord: meta.learningStatus?.newWord,
                  userInterestDetected: meta.learningStatus?.userInterestDetected,
                  isStreaming: false,
                }
              : m
          )
        );
        setSessionState("ai-speaking");
        // Auto-play TTS — text already displayed, audio plays in parallel
        speakGerman(meta.aiSpeechDe);
        setTimeout(() => setSessionState("idle"), 200);
        setTimeout(() => inputRef.current?.focus(), 250);
      },
      (errMsg) => {
        setError(errMsg ?? t("errorSend"));
        setRealMessages((prev) => prev.filter((m) => m.id !== tempAiId && m.id !== tempUserId));
        setSessionState("idle");
      }
    );
  }, [session, inputText, sessionState, t]);

  // ── Real mic toggle ─────────────────────────────────────────────────────────────
  const handleMicToggle = useCallback(async () => {
    if (!session) return;

    if (sessionState === "idle") {
      // Start recording
      try {
        const handle = await startRecorder((blob) => {
          // Recording stopped — upload for transcription
          setSessionState("processing");
          setAnalyser(null);
          recorderRef.current = null;

          aiSpeakingApi.transcribe(blob)
            .then((res) => {
              const transcript = res.data.transcript?.trim();
              if (transcript) {
                setInputText(transcript);
                // Auto-send
                handleSendText(transcript);
              } else {
                setError(t("transcriptionFailed"));
                setSessionState("idle");
              }
            })
            .catch(() => {
              setError(t("transcriptionFailed"));
              setSessionState("idle");
            });
        });
        recorderRef.current = handle;
        setAnalyser(handle.analyser);
        setSessionState("listening");
      } catch {
        setError(t("microphoneDenied"));
      }
    } else if (sessionState === "listening") {
      // Stop recording — triggers the onStop callback above
      recorderRef.current?.stop();
    }
  }, [session, sessionState, t, handleSendText]);

  // ── End session ──────────────────────────────────────────────────────────────
  const handleEnd = useCallback(async () => {
    recorderRef.current?.stop();
    streamCtrl.current?.abort();
    if (session) {
      try { await aiSpeakingApi.endSession(session.id); } catch { /* ignore */ }
    }
    setSessionState("summary");
  }, [session]);

  // ── Restart ──────────────────────────────────────────────────────────────────
  const handleRestart = () => {
    setSession(null);
    setRealMessages([]);
    setSeconds(0);
    setSessionState("idle");
    setError(null);
    setAnalyser(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendText(); }
  };

  const isMicDisabled = sessionState === "processing" || sessionState === "ai-speaking" || sessionState === "sending";

  return (
    <div className="min-h-screen flex items-start justify-center py-0 sm:py-8 sm:px-4"
      style={{ background: "linear-gradient(160deg, #070B14 0%, #0A1628 40%, #0D0A2E 100%)", minHeight: "100vh" }}>

      {/* Floating glow orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute rounded-full" style={{ top: "10%", left: "5%", width: 320, height: 320,
          background: "radial-gradient(circle, rgba(34,211,238,0.18) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div className="absolute rounded-full" style={{ top: "50%", right: "5%", width: 380, height: 380,
          background: "radial-gradient(circle, rgba(167,139,250,0.18) 0%, transparent 70%)", filter: "blur(50px)" }} />
        <div className="absolute rounded-full" style={{ bottom: "10%", left: "30%", width: 260, height: 260,
          background: "radial-gradient(circle, rgba(45,212,191,0.12) 0%, transparent 70%)", filter: "blur(35px)" }} />
      </div>

      {/* Language switcher (fixed top-right) */}
      <div className="fixed top-3 right-3 z-[60]">
        <LanguageSwitcher />
      </div>

      {/* Phone frame */}
      <div className="relative w-full sm:max-w-[420px] min-h-screen sm:min-h-0 flex flex-col sm:rounded-[40px] sm:overflow-hidden"
        style={{ background: "rgba(10,22,40,0.6)", backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)",
          border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 32px 80px rgba(0,0,0,0.5)" }}>

        {/* Top Bar */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1.5 py-1.5 px-2 rounded-[10px] transition-colors"
            style={{ color: "rgba(255,255,255,0.5)" }}>
            <ChevronLeft size={16} />
            <span className="text-xs">{t("back")}</span>
          </button>
          <div className="flex items-center gap-2">
            {session?.cefrLevel && (
              <span className="px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ background: `linear-gradient(135deg, ${CYAN}25, ${PURPLE}25)`, border: `1px solid ${CYAN}40`, color: CYAN }}>
                {session.cefrLevel}
              </span>
            )}
            {session && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <Clock size={11} style={{ color: "rgba(255,255,255,0.45)" }} />
                <span className="font-mono font-bold text-sm tracking-widest"
                  style={{ color: "rgba(255,255,255,0.9)", fontVariantNumeric: "tabular-nums" }}>
                  {formatTime(seconds)}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Explanation toggle */}
            {session && sessionState !== "summary" && (
              <button onClick={toggleExplanations}
                className="p-2 rounded-[10px] transition-colors"
                title={showExplanations ? t("hideExplanations") : t("showExplanations")}
                style={{ color: showExplanations ? CYAN : "rgba(255,255,255,0.4)" }}>
                {showExplanations ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            )}
            <button className="p-2 rounded-[10px] transition-colors" style={{ color: "rgba(255,255,255,0.4)" }}>
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2.5 rounded-[12px]"
              style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)" }}
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
              <p className="text-red-300 text-xs flex-1">{error}</p>
              <button onClick={() => setError(null)} style={{ color: "rgba(255,255,255,0.4)" }}>
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        {!session ? (
          <WelcomeScreen onStart={handleStartSession} isStarting={isStarting} />
        ) : sessionState === "summary" ? (
          <div className="flex-1 overflow-y-auto px-4 pt-4" ref={chatRef} style={{ scrollbarWidth: "none" }}>
            <SessionSummary
              realMessages={realMessages}
              mockExchanges={mockExchanges}
              duration={formatTime(seconds)}
              onRestart={handleRestart}
              onExit={() => router.push("/dashboard")} />
          </div>
        ) : (
          /* Active chat */
          <>
            <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4"
              style={{ minHeight: 0, scrollbarWidth: "none" }}>

              {realMessages.length === 0 && (
                <motion.div className="flex justify-center pt-4"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="rounded-[16px] px-5 py-4 text-center max-w-[260px]"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="text-2xl mb-2">🎙️</div>
                    <p className="text-xs font-semibold text-white mb-1">{t("sessionStarted")}</p>
                    <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
                      {t("sessionStartedHint")}
                    </p>
                  </div>
                </motion.div>
              )}

              {realMessages.map((msg) => (
                <RealChatBubble key={msg.id} msg={msg} showExplanations={showExplanations} />
              ))}
            </div>

            {/* Bottom controls */}
            <div className="flex-shrink-0 px-4 pb-4 pt-2"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>

              <div className="rounded-[20px] p-4 mb-3 flex flex-col items-center gap-1" style={glass}>
                <VoiceVisualizer state={sessionState} analyser={analyser} />
                <AnimatePresence mode="wait">
                  {sessionState === "idle" && (
                    <motion.div key="prompt" className="mt-2 rounded-[12px] px-4 py-2 text-center max-w-[280px]"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                      <p className="text-xs leading-snug" style={{ color: "rgba(255,255,255,0.55)" }}>
                        <span style={{ color: CYAN }}>{t("topicLabel")}:</span>{" "}
                        {session.topic ? session.topic : t("freeTopic")}
                      </p>
                    </motion.div>
                  )}
                  {sessionState === "listening" && (
                    <motion.p key="listen" className="text-xs mt-2 font-semibold" style={{ color: "#F87171" }}
                      initial={{ opacity: 0 }} animate={{ opacity: [1, 0.5, 1] }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.8, repeat: Infinity }}>
                      {t("statusListening")}
                    </motion.p>
                  )}
                  {sessionState === "processing" && (
                    <motion.p key="proc" className="text-xs mt-2 font-semibold" style={{ color: CYAN }}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      {t("transcribing")}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Text input */}
              <div className="flex items-end gap-2 mb-3">
                <div className="flex-1 relative">
                  <textarea ref={inputRef} value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t("inputPlaceholder")}
                    rows={1} disabled={isMicDisabled}
                    className="w-full px-3 py-2.5 rounded-[12px] text-sm outline-none resize-none"
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      border: `1px solid ${inputText ? CYAN + "40" : "rgba(255,255,255,0.1)"}`,
                      color: "rgba(255,255,255,0.9)", caretColor: CYAN, minHeight: 42, maxHeight: 100,
                    }}
                    onInput={(e) => {
                      const el = e.currentTarget;
                      el.style.height = "auto";
                      el.style.height = Math.min(el.scrollHeight, 100) + "px";
                    }} />
                </div>
                <motion.button onClick={() => handleSendText()}
                  disabled={!inputText.trim() || isMicDisabled}
                  className="flex-shrink-0 w-10 h-10 rounded-[12px] flex items-center justify-center"
                  style={{
                    background: inputText.trim() && !isMicDisabled
                      ? `linear-gradient(135deg, ${CYAN}, ${PURPLE})`
                      : "rgba(255,255,255,0.08)",
                    opacity: !inputText.trim() || isMicDisabled ? 0.4 : 1,
                  }}
                  whileTap={inputText.trim() && !isMicDisabled ? { scale: 0.9 } : {}}>
                  {sessionState === "sending"
                    ? <motion.div className="w-4 h-4 rounded-full border-2"
                        style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "white" }}
                        animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
                    : <Send size={16} className="text-white" />}
                </motion.button>
              </div>

              {/* Mic row */}
              <div className="flex items-center justify-between px-2">
                <button onClick={handleEnd}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-[12px] text-sm font-medium transition-colors"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <X size={14} /> {t("endButton")}
                </button>
                <MicButton state={sessionState} onToggle={handleMicToggle} />
                <div className="flex items-center gap-1.5 px-4 py-2 rounded-[12px]"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <Zap size={13} style={{ color: CYAN }} />
                  <span className="text-xs font-bold" style={{ color: CYAN }}>
                    {realMessages.filter((m) => m.role === "ASSISTANT" && !m.correction).length}/
                    {realMessages.filter((m) => m.role === "ASSISTANT").length}
                  </span>
                </div>
              </div>

              <p className="text-center text-[10px] mt-2" style={{ color: "rgba(255,255,255,0.25)" }}>
                {sessionState === "idle"        && t("statusIdle")}
                {sessionState === "listening"   && t("statusListeningStop")}
                {sessionState === "processing"  && t("transcribing")}
                {sessionState === "ai-speaking" && t("statusAiSpeaking")}
                {sessionState === "sending"     && t("statusSending")}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
