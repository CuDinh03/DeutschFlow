"use client";

import type { Ref } from "react";
import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeSpeakingPersona } from "./personaTheme";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder: string;
  disabled?: boolean;
  inputRef: Ref<HTMLTextAreaElement>;
  personaId?: string | null;
  sendLabel: string;
}

export function SpeakingMessageInput({
  value,
  onChange,
  onSend,
  placeholder,
  disabled,
  inputRef,
  personaId,
  sendLabel,
}: Props) {
  const pid = normalizeSpeakingPersona(personaId ?? undefined);
  const ring =
    pid === "EMMA"
      ? "focus:ring-amber-400/35"
      : pid === "LUKAS"
        ? "focus:ring-sky-400/35"
        : "focus:ring-amber-500/30";

  const sendGradient =
    pid === "EMMA"
      ? "from-amber-500 to-teal-600 shadow-[0_0_24px_rgba(245,158,11,0.25)]"
      : pid === "LUKAS"
        ? "from-sky-500 to-slate-700 shadow-[0_0_24px_rgba(56,189,248,0.22)]"
        : "from-amber-400 to-yellow-500 shadow-[0_0_20px_rgba(255,205,0,0.25)]";

  return (
    <div className="flex items-end gap-2">
      <textarea
        ref={inputRef}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "flex-1 min-h-[44px] max-h-32 rounded-[22px] px-4 py-3 text-sm resize-none",
          "bg-white/[0.07] border border-white/[0.12] text-white/90 placeholder:text-white/35",
          "transition-[box-shadow,transform] duration-200 focus:outline-none focus:ring-2",
          ring,
          "hover:bg-white/[0.09]",
        )}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
      />
      <motion.button
        type="button"
        onClick={onSend}
        disabled={disabled || !value.trim()}
        whileHover={{ scale: disabled || !value.trim() ? 1 : 1.06 }}
        whileTap={{ scale: disabled || !value.trim() ? 1 : 0.94 }}
        className={cn(
          "w-11 h-11 sm:w-12 sm:h-12 rounded-full text-white flex items-center justify-center flex-shrink-0",
          "disabled:opacity-30 bg-gradient-to-br transition-opacity",
          sendGradient,
        )}
        aria-label={sendLabel}
      >
        <Send size={18} aria-hidden />
      </motion.button>
    </div>
  );
}
