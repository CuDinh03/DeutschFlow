"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useChatStore, ChatMessage } from "@/store/useChatStore";
import { ChatMessageBubble } from "@/components/features/ai-speaking/ChatMessageBubble";
import { StreamStatusIndicator } from "@/components/features/ai-speaking/StreamStatusIndicator";
import { SuggestionBar } from "@/components/features/ai-speaking/SuggestionBar";
import { SessionSummary } from "@/components/features/ai-speaking/SessionSummary";
import { SpeakingPersonaMiniAvatar } from "@/components/speaking/SpeakingPersonaMiniAvatar";
import { ArrowLeft, Send, Mic, MicOff, X, Clock } from "lucide-react";
import { useSpeech } from "@/hooks/useSpeech";
import { chatStream, aiSpeakingApi } from "@/lib/aiSpeakingApi";
import type { Suggestion } from "@/lib/aiSpeakingApi";
import { AnimatePresence, motion } from "framer-motion";

type ViewMode = "chat" | "summary";

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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const suggestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // ─── Smart Suggestion Timer ────────────────────────────────
  // 0-12M juniors: 70s (60s think + 10s buffer)
  // 1y+ seniors: 10s (just a direction hint)
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


  // NOTE: selectedCompanion guard moved below all hooks to satisfy rules-of-hooks
  // (useCallback + useEffect must be called unconditionally every render)

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

    chatStream(
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

        // Save suggestions for later display
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
  // NOTE: useCallback placed here (after all other hooks) — selectedCompanion
  // guard is already enforced by the early return above, so hook order is stable
  const handleSpeak = useCallback(
    (text: string) => {
      // Find message id matching this text
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
    const sid = useChatStore.getState().sessionId;
    if (sid) {
      try {
        const res = await aiSpeakingApi.endSession(sid);
        // Save interview report if present (generated by backend for INTERVIEW mode)
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
    // Auto-send after short delay
    setTimeout(() => {
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
      // We need to set the text and trigger send
    }, 100);
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

  // ─── Clean up speech on unmount ────────────────────────────
  useEffect(() => {
    return () => {
      stopListening();
      stopSpeaking();
    };
  }, [stopListening, stopSpeaking]);

  // Guard: if no companion selected, redirect was already triggered by useEffect above
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

  // ─── CHAT VIEW ─────────────────────────────────────────────
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
              {sessionMode === "INTERVIEW" ? "🎤 Phỏng vấn" : "💬 Hội thoại"} • {selectedCompanion.cefrLevel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Timer */}
          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-500 dark:text-slate-400">
            <Clock size={12} />
            {formatTime(seconds)}
          </div>

          {/* End Session button */}
          <button
            onClick={handleEndSession}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800"
          >
            <X size={13} />
            Kết thúc
          </button>
        </div>
      </header>

      {/* ── Chat Messages Area ─────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2">
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

          {/* Suggestion Bar — shown 10s after last AI message */}
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

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* ── Input Area ─────────────────────────────────────────── */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4">
        <div className="max-w-3xl mx-auto w-full relative">
          <form
            onSubmit={handleSendMessage}
            className="flex items-end gap-2 bg-slate-100 dark:bg-slate-800 p-2 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-inner focus-within:ring-2 focus-within:ring-blue-500/50 transition-all"
          >
            <button
              type="button"
              onClick={toggleListening}
              className={`p-3 rounded-full transition-colors flex-shrink-0 ${
                isListening
                  ? "text-red-500 bg-red-100 dark:bg-red-900/30 animate-pulse"
                  : "text-slate-500 hover:text-blue-500 hover:bg-white dark:hover:bg-slate-700"
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
              className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:hover:bg-blue-600 flex-shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
          <div className="text-center mt-2">
            <span className="text-[11px] text-slate-400">
              {sessionMode === "INTERVIEW"
                ? isJunior
                  ? `Mẹo: AI sẽ gợi ý câu trả lời sau 70 giây nếu bạn chưa nhập.`
                  : `Mẹo: AI sẽ gợi ý hướng triển khai sau 10 giây nếu bạn chưa nhập.`
                : `Mẹo: AI sẽ gợi ý câu trả lời sau 10 giây nếu bạn chưa nhập.`
              }
            </span>
          </div>
        </div>
      </footer>

      {/* ── Shimmer Keyframes (injected globally) ──────────── */}
      <style jsx global>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
