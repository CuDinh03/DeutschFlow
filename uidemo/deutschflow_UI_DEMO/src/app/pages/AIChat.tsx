// ─────────────────────────────────────────────────────────────────────────────
// DeutschFlow · AIChat  (/chat)
// Master frame: AI text chat screen.
//
// Chat state machine:
//   "idle"      → Empty, waiting for user input
//   "thinking"  → User sent message, AI is processing
//   "streaming" → Latest AI message is being typewritten
//   "error"     → Network / AI failure (retry available)
//
// Components used (single source of truth):
//   ChatBubble      → All message variants
//   TypingIndicator → Thinking animation
//   ChatInput       → Input area with all states
//   CharacterFloat  → Floating character with physics
//   PERSONA_TOKENS  → All persona config (colors, replies)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, RefreshCcw } from "lucide-react";

import { PERSONA_TOKENS, PersonaId } from "../lib/personas";
import { LukasCharacter } from "../components/characters/LukasCharacter";
import { EmmaCharacter } from "../components/characters/EmmaCharacter";
import { ChatBubble } from "../components/chat/ChatBubble";
import { TypingIndicator } from "../components/chat/TypingIndicator";
import { ChatInput } from "../components/chat/ChatInput";
import { CharacterFloat } from "../components/chat/CharacterFloat";

// ── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  from: "user" | "ai";
  text: string;
  isError?: boolean;
}

type ChatState = "idle" | "thinking" | "streaming" | "error";

type LukasExpr = "neutral" | "smiling" | "thinking" | "talking" | "excited" | "confused";
type EmmaExpr  = "idle" | "smiling" | "winking" | "thinking" | "talking" | "excited";
type Expr = LukasExpr | EmmaExpr;

// ── Expression map per chat state ────────────────────────────────────────────
function getExpression(id: PersonaId, state: ChatState): Expr {
  if (id === "lukas") {
    switch (state) {
      case "thinking":  return "thinking";
      case "streaming": return "talking";
      case "error":     return "confused";
      default:          return "smiling";
    }
  } else {
    switch (state) {
      case "thinking":  return "thinking";
      case "streaming": return "talking";
      case "error":     return "idle";
      default:          return "smiling";
    }
  }
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AIChat() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const characterId: PersonaId = (location.state as any)?.character ?? "lukas";
  const p = PERSONA_TOKENS[characterId];

  // ── State ──────────────────────────────────────────────────────────
  const [messages,  setMessages]  = useState<Message[]>([]);
  const [input,     setInput]     = useState("");
  const [chatState, setChatState] = useState<ChatState>("idle");
  const [replyIdx,  setReplyIdx]  = useState(0);
  const [entered,   setEntered]   = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Derived values
  const expression    = getExpression(characterId, chatState);
  const isTalking     = chatState === "streaming";
  const isDisabled    = chatState === "thinking" || chatState === "streaming";
  const CharComponent = characterId === "lukas" ? LukasCharacter : EmmaCharacter;

  // ── Character entrance + greeting ──────────────────────────────────
  useEffect(() => {
    const t1 = setTimeout(() => setEntered(true), 300);
    const t2 = setTimeout(() => {
      deliverAIMessage(p.replies[0]);
    }, 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Scroll to bottom on new message ─────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatState]);

  // ── Deliver an AI message ────────────────────────────────────────────
  const deliverAIMessage = useCallback((text: string) => {
    setChatState("streaming");
    const id = Date.now().toString();
    setMessages((prev) => [...prev, { id, from: "ai", text }]);

    // After typewriter finishes (~32ms/char), switch back to idle
    const talkMs = Math.max(2200, text.length * 32);
    setTimeout(() => {
      setChatState("idle");
    }, talkMs);
  }, []);

  // ── Handle send ──────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isDisabled) return;

    // Add user message
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), from: "user", text: trimmed },
    ]);
    setInput("");
    setChatState("thinking");

    // Cycle AI replies
    const nextIdx = (replyIdx + 1) % p.replies.length;
    setReplyIdx(nextIdx);
    const reply = p.replies[nextIdx];

    const delay = 1400 + Math.random() * 600;
    setTimeout(() => {
      deliverAIMessage(reply);
    }, delay);
  }, [input, isDisabled, replyIdx, p.replies, deliverAIMessage]);

  // ── Reset conversation ──────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setMessages([]);
    setReplyIdx(0);
    setChatState("idle");
    setTimeout(() => deliverAIMessage(p.replies[0]), 400);
  }, [p.replies, deliverAIMessage]);

  // ── Retry on error ───────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    // Remove last error message and resend
    setMessages((prev) => prev.filter((m) => !m.isError));
    setChatState("thinking");
    const reply = p.replies[replyIdx % p.replies.length];
    setTimeout(() => deliverAIMessage(reply), 1200);
  }, [p.replies, replyIdx, deliverAIMessage]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col"
      style={{
        background: "#080818",
        color: "#fff",
        height: "100dvh",
        maxWidth: 430,
        margin: "0 auto",
        position: "relative",
      }}
    >

      {/* ── TOP BAR ─────────────────────────────────────────────────── */}
      <motion.div
        className="flex-shrink-0 flex items-center gap-3 px-4 pt-12 pb-4"
        style={{
          background: "rgba(8,8,24,0.95)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          zIndex: 30,
        }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Back */}
        <motion.button
          onClick={() => navigate("/companion")}
          className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.07)" }}
          whileTap={{ scale: 0.88 }}
        >
          <ArrowLeft size={18} style={{ color: "rgba(255,255,255,0.7)" }} />
        </motion.button>

        {/* Avatar */}
        <div className="relative w-10 h-10 flex-shrink-0">
          <div
            className="w-10 h-10 rounded-full overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: `2px solid ${p.accent}`,
            }}
          >
            <CharComponent
              expression={expression as never}
              style={{ transform: "scale(1.6) translateY(18%)" }}
            />
          </div>
          {/* Online dot */}
          <span
            className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#080818]"
            style={{ background: "#27AE60" }}
          />
        </div>

        {/* Name + status */}
        <div className="flex-1">
          <p className="font-black text-sm text-white">{p.name}</p>
          <p className="text-[11px]" style={{ color: p.accent }}>
            {chatState === "streaming"
              ? "tippt gerade..."
              : chatState === "thinking"
              ? "denkt nach..."
              : chatState === "error"
              ? "Fehler aufgetreten"
              : p.role}
          </p>
        </div>

        {/* Reset */}
        <motion.button
          className="w-9 h-9 flex items-center justify-center rounded-full"
          style={{ background: "rgba(255,255,255,0.07)" }}
          whileTap={{ scale: 0.88 }}
          onClick={handleReset}
        >
          <RefreshCcw size={15} style={{ color: "rgba(255,255,255,0.5)" }} />
        </motion.button>
      </motion.div>

      {/* ── CHAT AREA ────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">

        {/* Ambient glow */}
        <div
          className="absolute bottom-0 right-0 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: p.glow, filter: "blur(60px)", opacity: 0.28 }}
        />

        {/* Character */}
        <CharacterFloat
          CharComponent={CharComponent}
          expression={expression}
          isTalking={isTalking}
          entered={entered}
          persona={p}
        />

        {/* Messages layer */}
        <div
          ref={scrollRef}
          className="absolute inset-0 overflow-y-auto px-4 pt-4 pb-8 flex flex-col gap-3"
          style={{ zIndex: 10 }}
        >
          <AnimatePresence mode="popLayout">
            {messages.map((msg, idx) => {
              const isLastAI =
                msg.from === "ai" && idx === messages.length - 1 && chatState === "streaming";

              if (msg.isError) {
                return (
                  <div key={msg.id}>
                    <ChatBubble variant="error" onRetry={handleRetry} />
                  </div>
                );
              }

              return (
                <div key={msg.id}>
                  <ChatBubble
                    variant={
                      msg.from === "user"
                        ? "user"
                        : isLastAI
                        ? "streaming"
                        : "ai"
                    }
                    text={msg.text}
                    accent={p.accent}
                    bubbleBg={p.bubble}
                    border={p.border}
                    glow={p.glow}
                  />
                </div>
              );
            })}
          </AnimatePresence>

          {/* Thinking indicator */}
          <AnimatePresence>
            {chatState === "thinking" && (
              <motion.div
                key="typing"
                className="flex justify-start"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
              >
                <TypingIndicator
                  color={p.accent}
                  bubbleBg={p.bubble}
                  borderColor={p.border}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Spacer so messages don't go under the floating character */}
          <div className="h-40" />
        </div>
      </div>

      {/* ── INPUT AREA ───────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        style={{ zIndex: 30 }}
      >
        <AnimatePresence>
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={handleSend}
            placeholder={`Schreib an ${p.name}...`}
            accent={p.accent}
            glow={p.glow}
            isSpeaking={isTalking}
            isDisabled={isDisabled}
          />
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
