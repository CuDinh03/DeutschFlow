"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Settings, Zap, Clock, AlertTriangle, Send, X,
} from "lucide-react";
import { aiSpeakingApi, AiSpeakingSession, AiChatResponse } from "@/lib/aiSpeakingApi";
import { speakGerman, primeGermanVoices } from "@/lib/speechDe";
import {
  SessionState, AiMessageBubble, Exchange,
  CYAN, PURPLE, glass,
  VoiceVisualizer, MicButton, RealChatBubble, SessionSummary, WelcomeScreen,
} from "@/components/speaking";

export default function SpeakingPage() {
  const router = useRouter();

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

  const chatRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const handleStartSession = useCallback(async (topic?: string) => {
    setIsStarting(true);
    setError(null);
    try {
      const res = await aiSpeakingApi.createSession(topic);
      setSession(res.data);
      setRealMessages([]);
      setSeconds(0);
      setSessionState("idle");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "Fehler beim Starten der Sitzung.");
    } finally {
      setIsStarting(false);
    }
  }, []);

  // ── Send text message ─────────────────────────────────────────────────────────
  const handleSendText = useCallback(async () => {
    if (!session || !inputText.trim() || sessionState === "sending") return;
    const text = inputText.trim();
    setInputText("");
    setSessionState("sending");
    setError(null);

    const tempId = Date.now();
    setRealMessages((prev) => [...prev, { id: tempId, role: "USER", userText: text }]);

    try {
      const res = await aiSpeakingApi.chat(session.id, text);
      const d: AiChatResponse = res.data;
      setRealMessages((prev) => [
        ...prev,
        {
          id: d.messageId, role: "ASSISTANT",
          aiSpeechDe: d.aiSpeechDe,
          correction: d.correction,
          explanationVi: d.explanationVi,
          grammarPoint: d.grammarPoint,
        },
      ]);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "Fehler beim Senden.");
      setRealMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSessionState("idle");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [session, inputText, sessionState]);

  // ── Mic toggle (simulated STT — Whisper integration TODO) ────────────────────
  const handleMicToggle = useCallback(() => {
    if (!session) return;
    if (sessionState === "idle") {
      setSessionState("listening");
      stateRef.current = setTimeout(() => {
        setSessionState("processing");
        setTimeout(() => {
          setSessionState("ai-speaking");
          setTimeout(() => setSessionState("idle"), 2800);
        }, 1400);
      }, 2800);
    } else if (sessionState === "listening") {
      clearTimeout(stateRef.current!);
      setSessionState("processing");
      setTimeout(() => {
        setSessionState("ai-speaking");
        setTimeout(() => setSessionState("idle"), 2800);
      }, 1400);
    }
  }, [session, sessionState]);

  // ── End session ──────────────────────────────────────────────────────────────
  const handleEnd = useCallback(async () => {
    clearTimeout(stateRef.current!);
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
            <span className="text-xs">Zurück</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: `linear-gradient(135deg, ${CYAN}25, ${PURPLE}25)`, border: `1px solid ${CYAN}40`, color: CYAN }}>
              B1
            </span>
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
          <button className="p-2 rounded-[10px] transition-colors" style={{ color: "rgba(255,255,255,0.4)" }}>
            <Settings size={16} />
          </button>
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
                    <p className="text-xs font-semibold text-white mb-1">Sitzung gestartet!</p>
                    <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
                      Tippe eine Nachricht oder drücke den Mikrofon-Knopf.
                    </p>
                  </div>
                </motion.div>
              )}

              {realMessages.map((msg) => (
                <RealChatBubble key={msg.id} msg={msg} />
              ))}

              {(sessionState === "processing" || sessionState === "sending") && (
                <motion.div className="flex items-center gap-2.5"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: `linear-gradient(145deg, ${CYAN}, ${PURPLE})` }}>🤖</div>
                  <div className="rounded-[14px] rounded-tl-[4px] px-4 py-3 flex items-center gap-1.5"
                    style={{ background: "rgba(34,211,238,0.09)", border: `1px solid rgba(34,211,238,0.2)` }}>
                    {[0, 0.2, 0.4].map((d) => (
                      <motion.div key={d} className="w-1.5 h-1.5 rounded-full" style={{ background: CYAN }}
                        animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: d }} />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Bottom controls */}
            <div className="flex-shrink-0 px-4 pb-4 pt-2"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>

              <div className="rounded-[20px] p-4 mb-3 flex flex-col items-center gap-1" style={glass}>
                <VoiceVisualizer state={sessionState} />
                <AnimatePresence mode="wait">
                  {sessionState === "idle" && (
                    <motion.div key="prompt" className="mt-2 rounded-[12px] px-4 py-2 text-center max-w-[280px]"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                      <p className="text-xs leading-snug" style={{ color: "rgba(255,255,255,0.55)" }}>
                        <span style={{ color: CYAN }}>Thema:</span>{" "}
                        {session.topic ? session.topic : "Freies Gespräch — sprich über alles!"}
                      </p>
                    </motion.div>
                  )}
                  {sessionState === "listening" && (
                    <motion.p key="listen" className="text-xs mt-2 font-semibold" style={{ color: "#F87171" }}
                      initial={{ opacity: 0 }} animate={{ opacity: [1, 0.5, 1] }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.8, repeat: Infinity }}>
                      Spreche jetzt auf Deutsch...
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
                    placeholder="Schreib auf Deutsch… (Enter zum Senden)"
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
                <motion.button onClick={handleSendText}
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
                  <X size={14} /> Beenden
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
                {sessionState === "idle"        && "Tippe oder drücke den Knopf und sprich frei"}
                {sessionState === "listening"   && "Drücke erneut zum Stoppen"}
                {sessionState === "processing"  && "KI verarbeitet deine Eingabe..."}
                {sessionState === "ai-speaking" && "KI spricht..."}
                {sessionState === "sending"     && "Nachricht wird gesendet..."}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
