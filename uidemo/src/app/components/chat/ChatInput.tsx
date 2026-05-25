// ─────────────────────────────────────────────────────────────────────────────
// DeutschFlow · ChatInput
// Master input area component for the AI Chat screen.
//
// States:
//   "idle"      — Empty, no content
//   "active"    — User has typed text, send button is enabled
//   "disabled"  — AI is thinking/talking, all controls locked
//   "listening" — Microphone active (future voice integration)
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useEffect } from "react";
import { motion } from "motion/react";
import { Mic, Send, Sparkles } from "lucide-react";

export type InputState = "idle" | "active" | "disabled" | "listening";

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onMic?: () => void;
  placeholder?: string;
  /** Persona accent color — drives border, send button, active state */
  accent: string;
  glow: string;
  /** Whether the AI is currently speaking (shows transcript badge above) */
  isSpeaking?: boolean;
  isDisabled?: boolean;
}

function deriveState(value: string, isDisabled: boolean): InputState {
  if (isDisabled) return "disabled";
  if (value.trim().length > 0) return "active";
  return "idle";
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onMic,
  placeholder = "Schreib hier...",
  accent,
  glow,
  isSpeaking = false,
  isDisabled = false,
}: ChatInputProps) {
  const state = deriveState(value, isDisabled);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (state === "active") onSend();
    }
  };

  const sendActive = state === "active";

  return (
    <div className="flex-shrink-0 relative">
      {/* ── Transcript / speaking badge ─────────────────────────────── */}
      {isSpeaking && (
        <motion.div
          className="absolute bottom-full left-4 right-4 mb-2 px-4 py-2.5 rounded-[14px] flex items-center gap-2.5"
          style={{
            background: "rgba(20,20,50,0.96)",
            border: `1px solid ${accent}30`,
            zIndex: 35,
          }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
        >
          <motion.div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: accent }}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
          <p className="text-xs flex-1" style={{ color: "rgba(255,255,255,0.5)" }}>
            Echtzeit-Übertragung aktiv...
          </p>
          <Sparkles size={11} style={{ color: accent, flexShrink: 0 }} />
        </motion.div>
      )}

      {/* ── Input row ────────────────────────────────────────────────── */}
      <div
        className="px-4 pb-10 pt-3 flex items-end gap-3"
        style={{
          background: "linear-gradient(0deg, #080818 70%, rgba(8,8,24,0))",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {/* Mic button */}
        <motion.button
          type="button"
          onClick={onMic}
          disabled={isDisabled}
          className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full"
          style={{
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.1)",
            opacity: isDisabled ? 0.45 : 1,
          }}
          whileTap={isDisabled ? {} : { scale: 0.86 }}
        >
          <Mic size={18} style={{ color: "rgba(255,255,255,0.5)" }} />
        </motion.button>

        {/* Text input wrapper */}
        <div className="flex-1 flex items-end gap-2">
          <motion.div
            className="flex-1 flex items-end rounded-[20px] px-4 py-3 min-h-[48px]"
            animate={{
              borderColor:
                state === "active"
                  ? `${accent}70`
                  : "rgba(255,255,255,0.1)",
            }}
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1.5px solid rgba(255,255,255,0.1)",
            }}
          >
            <textarea
              ref={textareaRef}
              className="flex-1 bg-transparent text-white text-sm resize-none outline-none placeholder-white/30 leading-snug"
              placeholder={placeholder}
              rows={1}
              value={value}
              disabled={isDisabled}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ maxHeight: 96, minHeight: 22 }}
            />
          </motion.div>

          {/* Send button */}
          <motion.button
            type="button"
            onClick={onSend}
            disabled={!sendActive}
            className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full"
            style={{
              background: sendActive
                ? `linear-gradient(135deg, ${accent}, ${accent}BB)`
                : "rgba(255,255,255,0.07)",
              boxShadow: sendActive ? `0 4px 16px ${glow}` : "none",
            }}
            animate={{ scale: sendActive ? 1 : 0.95 }}
            whileTap={sendActive ? { scale: 0.86 } : {}}
            transition={{ type: "spring", stiffness: 400, damping: 24 }}
          >
            <Send
              size={18}
              style={{
                color: sendActive ? "#fff" : "rgba(255,255,255,0.3)",
              }}
            />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
