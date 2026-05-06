'use client'

import { motion } from "framer-motion";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { useTypewriter } from "@/hooks/useTypewriter";

// ── Shared entrance animation ────────────────────────────────────────────────
const BUBBLE_INITIAL  = { opacity: 0, y: 14, scale: 0.95 };
const BUBBLE_ANIMATE  = { opacity: 1, y: 0,  scale: 1    };
const BUBBLE_SPRING   = { type: "spring" as const, stiffness: 300, damping: 26 };

// ── Sub-component: Cursor blink ──────────────────────────────────────────────
function Cursor({ color }: { color: string }) {
  return (
    <motion.span
      className="inline-block w-0.5 h-4 ml-0.5 rounded-full"
      style={{ background: color, verticalAlign: "middle" }}
      animate={{ opacity: [1, 0] }}
      transition={{ duration: 0.5, repeat: Infinity }}
    />
  );
}

// ── Variant: User bubble ─────────────────────────────────────────────────────
interface UserBubbleProps { text: string; }
function UserBubble({ text }: UserBubbleProps) {
  return (
    <motion.div
      className="flex justify-end"
      initial={BUBBLE_INITIAL}
      animate={BUBBLE_ANIMATE}
      transition={BUBBLE_SPRING}
    >
      <div
        className="max-w-[75%] px-4 py-3 rounded-[18px] rounded-br-[6px] text-sm leading-relaxed text-white shadow-lg"
        style={{ background: "linear-gradient(135deg, #00305E, #2D9CDB)" }}
      >
        {text}
      </div>
    </motion.div>
  );
}

// ── Variant: AI bubble (already delivered) ───────────────────────────────────
interface AIBubbleProps {
  text: string;
  bubbleBg: string;
  border: string;
  glow: string;
}
function AIBubble({ text, bubbleBg, border, glow }: AIBubbleProps) {
  return (
    <motion.div
      className="flex justify-start"
      initial={BUBBLE_INITIAL}
      animate={BUBBLE_ANIMATE}
      transition={BUBBLE_SPRING}
    >
      <div
        className="max-w-[75%] px-4 py-3 rounded-[18px] rounded-bl-[6px] shadow-lg"
        style={{
          background: bubbleBg,
          border: `1px solid ${border}`,
          boxShadow: `0 4px 20px ${glow}`,
        }}
      >
        <span className="text-sm leading-relaxed text-white">{text}</span>
      </div>
    </motion.div>
  );
}

// ── Variant: Streaming bubble (typewriter + cursor) ──────────────────────────
interface StreamingBubbleProps {
  text: string;
  accent: string;
  bubbleBg: string;
  border: string;
  glow: string;
}
function StreamingBubble({ text, accent, bubbleBg, border, glow }: StreamingBubbleProps) {
  const { displayed, done } = useTypewriter(text, true, 26);
  return (
    <motion.div
      className="flex justify-start"
      initial={BUBBLE_INITIAL}
      animate={BUBBLE_ANIMATE}
      transition={BUBBLE_SPRING}
    >
      <div
        className="max-w-[75%] px-4 py-3 rounded-[18px] rounded-bl-[6px] shadow-lg"
        style={{
          background: bubbleBg,
          border: `1px solid ${border}`,
          boxShadow: `0 4px 20px ${glow}`,
        }}
      >
        <span className="text-sm leading-relaxed text-white">
          {displayed}
          {!done && <Cursor color={accent} />}
        </span>
      </div>
    </motion.div>
  );
}

// ── Variant: Error bubble ─────────────────────────────────────────────────────
interface ErrorBubbleProps { onRetry?: () => void; }
function ErrorBubble({ onRetry }: ErrorBubbleProps) {
  return (
    <motion.div
      className="flex justify-start"
      initial={BUBBLE_INITIAL}
      animate={BUBBLE_ANIMATE}
      transition={BUBBLE_SPRING}
    >
      <div
        className="max-w-[75%] px-4 py-3 rounded-[18px] rounded-bl-[6px] flex items-start gap-2.5"
        style={{
          background: "rgba(235,87,87,0.12)",
          border: "1px solid rgba(235,87,87,0.3)",
        }}
      >
        <AlertTriangle size={15} className="text-[#EB5757] flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-white/80 leading-relaxed">
            Verbindungsfehler. Bitte versuche es erneut.
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1 mt-2 text-xs font-semibold text-[#EB5757]"
            >
              <RefreshCcw size={11} /> Erneut versuchen
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Public API ────────────────────────────────────────────────────────────────
export type BubbleVariant = "user" | "ai" | "streaming" | "error";

export interface ChatBubbleProps {
  variant: BubbleVariant;
  text?: string;
  // Persona colors — required for ai/streaming variants
  accent?: string;
  bubbleBg?: string;
  border?: string;
  glow?: string;
  // Error variant
  onRetry?: () => void;
}

export function ChatBubble({
  variant,
  text = "",
  accent = "#2D9CDB",
  bubbleBg = "#1A3A52",
  border = "rgba(45,156,219,0.25)",
  glow = "rgba(45,156,219,0.3)",
  onRetry,
}: ChatBubbleProps) {
  switch (variant) {
    case "user":
      return <UserBubble text={text} />;
    case "ai":
      return <AIBubble text={text} bubbleBg={bubbleBg} border={border} glow={glow} />;
    case "streaming":
      return <StreamingBubble text={text} accent={accent} bubbleBg={bubbleBg} border={border} glow={glow} />;
    case "error":
      return <ErrorBubble onRetry={onRetry} />;
  }
}
