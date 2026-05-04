"use client";

import type { LegacyRef, RefObject } from "react";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Mic, Send, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder: string;
  disabled?: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  sendLabel: string;
  accent: string;
  glow: string;
  /** Strip above composer while assistant streams (UIDemo ChatInput). */
  isAssistantSpeaking: boolean;
  /** UIDemo ChatInput: mic toggles voice capture (session mic stays here, not in a separate strip). */
  onMicToggle: () => void;
  micDisabled?: boolean;
  /** Recording active — highlights mic control */
  isListening?: boolean;
}

/**
 * Text composer matching `uidemo/.../ChatInput`: mic | textarea + send in one row.
 */
export function SpeakingCompanionInput({
  value,
  onChange,
  onSend,
  placeholder,
  disabled,
  inputRef,
  sendLabel,
  accent,
  glow,
  isAssistantSpeaking,
  onMicToggle,
  micDisabled,
  isListening,
}: Props) {
  const t = useTranslations("speaking");
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, [value, inputRef]);

  const sendActive = value.trim().length > 0 && !disabled;
  const state: "active" | "disabled" | "idle" = disabled ? "disabled" : sendActive ? "active" : "idle";
  const micOff = !!micDisabled;

  return (
    <div className="relative flex-shrink-0">
      {isAssistantSpeaking && (
        <motion.div
          className="absolute bottom-full left-4 right-4 z-[35] mb-2 flex items-center gap-2.5 rounded-[14px] px-4 py-2.5"
          style={{
            background: "rgba(20,20,50,0.96)",
            border: `1px solid ${accent}30`,
          }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
        >
          <motion.div
            className="h-2 w-2 flex-shrink-0 rounded-full"
            style={{ background: accent }}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
          <p className="flex-1 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
            {t("companionLive")}
          </p>
          <Sparkles size={11} style={{ color: accent, flexShrink: 0 }} aria-hidden />
        </motion.div>
      )}

      <div
        className="flex items-end gap-3 px-4 pb-10 pt-3"
        style={{
          background: "linear-gradient(0deg, #080818 70%, rgba(8,8,24,0))",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <motion.button
          type="button"
          onClick={onMicToggle}
          disabled={micOff}
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
          style={{
            background: "rgba(255,255,255,0.07)",
            border: isListening ? `1px solid ${accent}88` : "1px solid rgba(255,255,255,0.1)",
            opacity: micOff ? 0.45 : 1,
          }}
          whileTap={micOff ? {} : { scale: 0.86 }}
          aria-label={t("micAria")}
        >
          <Mic size={18} style={{ color: isListening ? accent : "rgba(255,255,255,0.5)" }} aria-hidden />
        </motion.button>

        <div className="flex flex-1 items-end gap-2">
          <motion.div
            className="flex min-h-[48px] flex-1 items-end rounded-[20px] px-4 py-3"
            animate={{
              borderColor: state === "active" ? `${accent}70` : "rgba(255,255,255,0.1)",
            }}
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1.5px solid rgba(255,255,255,0.1)",
            }}
          >
            <textarea
              ref={inputRef as LegacyRef<HTMLTextAreaElement>}
              className="max-h-24 min-h-[22px] flex-1 resize-none bg-transparent text-sm leading-snug text-white outline-none placeholder:text-white/30"
              placeholder={placeholder}
              rows={1}
              value={value}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (sendActive) onSend();
                }
              }}
            />
          </motion.div>

          <motion.button
            type="button"
            onClick={onSend}
            disabled={!sendActive}
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
            style={{
              background: sendActive ? `linear-gradient(135deg, ${accent}, ${accent}BB)` : "rgba(255,255,255,0.07)",
              boxShadow: sendActive ? `0 4px 16px ${glow}` : "none",
            }}
            animate={{ scale: sendActive ? 1 : 0.95 }}
            whileTap={sendActive ? { scale: 0.86 } : {}}
            aria-label={sendLabel}
          >
            <Send size={18} style={{ color: sendActive ? "#fff" : "rgba(255,255,255,0.3)" }} aria-hidden />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
