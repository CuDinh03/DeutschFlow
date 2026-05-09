"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useChatStore, ChatMessage } from "@/store/useChatStore";
import { ChatMessageBubble } from "@/components/features/ai-speaking/ChatMessageBubble";
import { StreamStatusIndicator } from "@/components/features/ai-speaking/StreamStatusIndicator";
import { SuggestionBar } from "@/components/features/ai-speaking/SuggestionBar";
import { SessionSummary } from "@/components/features/ai-speaking/SessionSummary";
import { SpeakingPersonaMiniAvatar } from "@/components/speaking/SpeakingPersonaMiniAvatar";
import { ArrowLeft, Send, Mic, MicOff, X, Clock, CheckCircle } from "lucide-react";
import { useSpeech } from "@/hooks/useSpeech";
import { chatStream, aiSpeakingApi } from "@/lib/aiSpeakingApi";
import type { Suggestion } from "@/lib/aiSpeakingApi";
import { AnimatePresence, motion } from "framer-motion";

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
];

function detectInterviewEnd(text: string): boolean {
  const lower = text.toLowerCase();
  return INTERVIEW_END_KEYWORDS.some((kw) => lower.includes(kw));
}

export default function AIChatInterface() {
  const router = useRouter();
  const {
    selectedCompanion,
    sessionId,
    sessionMode,
    experienceLevel,
    setInterviewReportJson,
    messages,
    addMessage,
    updateLastMessage,
    streamStatus,
    setStreamStatus,
    clearChat,
  } = useChatStore();

  const [inputText, setInputText] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lastSuggestions, setLastSuggestions] = useState<Suggestion[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [showEndPopup, setShowEndPopup] = useState(false);
  const [greetingSpoken, setGreetingSpoken] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const suggestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  const { isListening, isSpeaking, startListening, stopListening, speak, speakWithPersona, stopSpeaking } = useSpeech({
    lang: "de-DE",
  });

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
    }
  }, [selectedCompanion, router]);

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
      setTimeout(() => {
        speakWithPersona(
          messages[0].contentDe,
          selectedCompanion.id,
          selectedCompanion.voiceFile,
        );
      }, 500);
    }
  }, [messages, selectedCompanion, greetingSpoken, speakWithPersona]);

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

  // ─── Handle Send Message ───────────────────────────────────
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const userText = inputText.trim();
    setShowSuggestions(false);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      contentDe: userText,
    };
    addMessage(userMsg);
    setInputText("");
    setStreamStatus("processing");

    const sid = useChatStore.getState().sessionId;
    if (!sid) {
      setStreamStatus("idle");
      return;
    }

    addMessage({
      id: crypto.randomUUID(),
      role: "ai",
      contentDe: "",
      isStreaming: true,
    });

    let currentDe = "";

    // Abort any previous stream before starting a new one
    streamAbortRef.current?.abort();

    streamAbortRef.current = chatStream(
      sid,
      userText,
      (delta) => {
        if (useChatStore.getState().streamStatus !== "streaming") {
          setStreamStatus("streaming");
        }
        currentDe += delta;
        updateLastMessage({ contentDe: currentDe });
      },
      (meta) => {
        setStreamStatus("idle");

        if (meta.suggestions && meta.suggestions.length > 0) {
          setLastSuggestions(meta.suggestions);
        }

        updateLastMessage({
          contentDe: meta.aiSpeechDe,
          isStreaming: false,
          feedback: {
            errors: meta.errors || [],
            explanationVi: meta.explanationVi || "",
            suggestions: meta.suggestions || [],
            correction: meta.correction || null,
            grammarPoint: meta.grammarPoint || null,
            action: meta.action || null,
          },
        });
        if (meta.aiSpeechDe && selectedCompanion) {
          speakWithPersona(
            meta.aiSpeechDe,
            selectedCompanion.id,
            selectedCompanion.voiceFile,
          );
        } else if (meta.aiSpeechDe) {
          speak(meta.aiSpeechDe);
        }
      },
      (err) => {
        setStreamStatus("idle");
        updateLastMessage({
          contentDe: currentDe || "Xin lỗi, đã xảy ra lỗi kết nối.",
          isStreaming: false,
        });
        console.error("Chat error:", err);
      }
    );
  };

  // ─── Handle Speak (TTS replay) ─────────────────────────────
  const handleSpeak = useCallback(
    (text: string) => {
      const msg = messages.find((m) => m.contentDe === text);
      if (msg) setSpeakingMsgId(msg.id);

      if (selectedCompanion) {
        speakWithPersona(
          text,
          selectedCompanion.id,
          selectedCompanion.voiceFile,
          () => setSpeakingMsgId(null)
        );
      } else {
        speak(text, () => setSpeakingMsgId(null));
      }
    },
    [messages, speak, speakWithPersona, selectedCompanion]
  );

  // ─── Handle End Session ────────────────────────────────────
  const handleEndSession = async () => {
    setShowEndPopup(false);
    // Abort any running SSE stream first
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    const sid = useChatStore.getState().sessionId;
    if (sid) {
      try {
        const res = await aiSpeakingApi.endSession(sid);
        if (res.data?.interviewReportJson) {
          setInterviewReportJson(res.data.interviewReportJson);
        }
      } catch (err) {
        console.error("Failed to end session", err);
      }
    }
    stopSpeaking();
    setViewMode("summary");
  };

  // ─── Handle Suggestion Select ──────────────────────────────
  const handleSuggestionSelect = (text: string) => {
    setInputText(text);
    setShowSuggestions(false);
  };

  // ─── Toggle listening ──────────────────────────────────────
  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening((text, isFinal) => {
        setInputText(text);
      });
    }
  };

  // ─── Clean up speech + stream on unmount / navigate away ──
  useEffect(() => {
    return () => {
      // Abort any running SSE stream to free Groq connection
      streamAbortRef.current?.abort();
      streamAbortRef.current = null;
      stopListening();
      stopSpeaking();
      // Auto-end the session when user navigates away
      const sid = useChatStore.getState().sessionId;
      if (sid) {
        aiSpeakingApi.endSession(sid).catch(() => {});
      }
    };
  }, [stopListening, stopSpeaking]);

  if (!selectedCompanion) return null;

  // ─── SUMMARY VIEW ──────────────────────────────────────────
  if (viewMode === "summary") {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ background: "linear-gradient(180deg, #0A0F1E 0%, #0F172A 60%, #1A1535 100%)" }}
      >
        <div className="max-w-[460px] mx-auto w-full flex flex-col flex-1 p-4 overflow-y-auto">
          <SessionSummary
            messages={messages}
            duration={formatTime(seconds)}
            isInterviewMode={sessionMode === "INTERVIEW"}
            interviewReportJson={useChatStore.getState().interviewReportJson}
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

  // ─── CHAT VIEW (2-column layout on desktop) ────────────────
  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/speaking")}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <SpeakingPersonaMiniAvatar
            personaId={selectedCompanion.id}
            chatBusy={streamStatus === "streaming"}
            className="w-10 h-10 border-2 border-slate-100 dark:border-slate-700 bg-slate-200"
          />
          <div>
            <h1 className="font-bold text-slate-900 dark:text-white leading-tight">
              {selectedCompanion.name}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {isInterview ? "🎤 Phỏng vấn" : "💬 Hội thoại"} • {selectedCompanion.cefrLevel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-500 dark:text-slate-400">
            <Clock size={12} />
            {formatTime(seconds)}
          </div>
          <button
            onClick={handleEndSession}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800"
          >
            <X size={13} />
            Kết thúc
          </button>
        </div>
      </header>

      {/* ── Main Content: 2-column on desktop ──────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── LEFT COLUMN: Chat Messages (65%) ──────────────────── */}
        <main className="flex-1 md:w-[65%] md:flex-none overflow-y-auto p-4 md:p-6 space-y-2">
          <div className="max-w-3xl mx-auto w-full">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center mt-20 opacity-60">
                <div className="w-20 h-20 mb-4 rounded-full bg-slate-200 dark:bg-slate-800" />
                <p className="text-slate-500">Hãy bắt đầu cuộc hội thoại với {selectedCompanion.name}</p>
              </div>
            )}

            {messages.map((msg) => (
              <ChatMessageBubble
                key={msg.id}
                message={msg}
                onSpeak={msg.role === "ai" ? handleSpeak : undefined}
                isSpeakingThis={speakingMsgId === msg.id && isSpeaking}
              />
            ))}

            <StreamStatusIndicator status={streamStatus} />

            {/* Mobile only: show suggestions inline */}
            <div className="md:hidden">
              <AnimatePresence>
                {showSuggestions && lastSuggestions.length > 0 && (
                  <SuggestionBar
                    suggestions={lastSuggestions}
                    onSelect={(text) => {
                      setInputText(text);
                      setShowSuggestions(false);
                    }}
                  />
                )}
              </AnimatePresence>
            </div>

            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* ── RIGHT COLUMN: Recording + Suggestions (35%) ─────── */}
        <aside className="hidden md:flex md:w-[35%] flex-col border-l border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 overflow-y-auto">
          <div className="p-4 space-y-4 flex-1">
            {/* Recording / Voice Input Panel */}
            {isListening && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="rounded-2xl p-4 border-2 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30"
                style={{ minHeight: inputText ? `${Math.max(80, inputText.length * 0.8)}px` : "80px" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">
                    Đang ghi âm...
                  </span>
                </div>
                {inputText && (
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">
                    &ldquo;{inputText}&rdquo;
                  </p>
                )}
                {!inputText && (
                  <div className="flex items-center gap-1 mt-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1 bg-red-400 rounded-full"
                        animate={{ height: [8, 20, 8] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Text Input Preview (when typing) */}
            {!isListening && inputText && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl p-4 border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                    Đang soạn tin
                  </span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {inputText}
                </p>
              </motion.div>
            )}

            {/* Suggestions Panel (desktop) */}
            <AnimatePresence>
              {showSuggestions && lastSuggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  className="space-y-2"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                      💡 Gợi ý trả lời
                    </span>
                  </div>
                  {lastSuggestions.map((s, i) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      onClick={() => {
                        setInputText(typeof s === "string" ? s : s.german_text);
                        setShowSuggestions(false);
                      }}
                      className="w-full text-left p-3 rounded-xl text-sm leading-relaxed transition-all bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-sm text-slate-700 dark:text-slate-300"
                    >
                      <span className="text-[10px] font-bold text-amber-500 mr-1.5">{i + 1}.</span>
                      {typeof s === "string" ? s : s.german_text}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty state */}
            {!isListening && !inputText && !(showSuggestions && lastSuggestions.length > 0) && (
              <div className="flex flex-col items-center justify-center text-center py-12 opacity-40">
                <Mic size={32} className="mb-3 text-slate-400" />
                <p className="text-xs text-slate-500 max-w-[200px]">
                  Phần ghi âm và gợi ý câu trả lời sẽ hiển thị ở đây
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ── Input Area ─────────────────────────────────────────── */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4">
        <div className="max-w-3xl mx-auto w-full md:w-[65%] md:mx-0 md:ml-0 relative">
          <form
            onSubmit={handleSendMessage}
            className="flex items-end gap-2 bg-slate-100 dark:bg-slate-800 p-2 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-inner focus-within:ring-2 focus-within:ring-amber-500/50 transition-all"
          >
            <button
              type="button"
              onClick={toggleListening}
              className={`p-3 rounded-full transition-colors flex-shrink-0 ${
                isListening
                  ? "text-red-500 bg-red-100 dark:bg-red-900/30 animate-pulse"
                  : "text-slate-500 hover:text-amber-500 hover:bg-white dark:hover:bg-slate-700"
              }`}
              title="Sử dụng giọng nói (STT)"
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={`Nhắn tin với ${selectedCompanion.name}...`}
              className="flex-1 bg-transparent border-none outline-none resize-none max-h-32 min-h-[44px] py-3 px-2 text-slate-800 dark:text-slate-200"
              rows={1}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || streamStatus !== "idle"}
              className="p-3 bg-brand-black text-brand-yellow rounded-full hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:hover:bg-brand-black flex-shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
          <div className="text-center mt-2">
            <span className="text-[11px] text-slate-400">
              {isInterview
                ? isJunior
                  ? `Mẹo: AI sẽ gợi ý câu trả lời sau 70 giây nếu bạn chưa nhập.`
                  : `Mẹo: AI sẽ gợi ý hướng triển khai sau 10 giây nếu bạn chưa nhập.`
                : `Mẹo: AI sẽ gợi ý câu trả lời sau 10 giây nếu bạn chưa nhập.`
              }
            </span>
          </div>
        </div>
      </footer>

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
                  Buổi phỏng vấn đã kết thúc!
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                  {selectedCompanion.name} đã cảm ơn bạn tham gia phỏng vấn. Hãy xem kết quả đánh giá chi tiết.
                </p>
                <button
                  onClick={handleEndSession}
                  className="w-full py-3.5 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #121212, #333)", boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}
                >
                  Kết thúc & Xem kết quả
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
