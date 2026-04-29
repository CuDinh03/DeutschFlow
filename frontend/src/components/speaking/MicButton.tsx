"use client";

import { motion } from "framer-motion";
import { Mic, MicOff } from "lucide-react";
import { SessionState, CYAN, PURPLE } from "./types";

interface MicButtonProps {
  state: SessionState;
  onToggle: () => void;
}

export function MicButton({ state, onToggle }: MicButtonProps) {
  const isListening = state === "listening";
  const isDisabled  = state === "processing" || state === "ai-speaking" || state === "sending";

  return (
    <div className="relative flex items-center justify-center">
      {isListening && [0, 0.25, 0.55].map((delay, i) => (
        <motion.div key={i} className="absolute rounded-full"
          style={{ width: 88, height: 88, border: "2px solid rgba(239,68,68,0.5)" }}
          animate={{ scale: [1, 2.8], opacity: [0.7, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, delay, ease: "easeOut" }} />
      ))}
      {!isListening && !isDisabled && (
        <motion.div className="absolute rounded-full"
          style={{ width: 88, height: 88, background: `radial-gradient(circle, rgba(34,211,238,0.15) 0%, transparent 70%)` }}
          animate={{ scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2.5, repeat: Infinity }} />
      )}
      <motion.button
        onClick={() => !isDisabled && onToggle()}
        className="relative z-10 flex items-center justify-center rounded-full"
        style={{
          width: 80, height: 80,
          background: isDisabled
            ? "rgba(255,255,255,0.08)"
            : isListening
            ? "linear-gradient(145deg, #F87171, #EF4444)"
            : `linear-gradient(145deg, ${CYAN}, ${PURPLE})`,
          boxShadow: isDisabled ? "none"
            : isListening
            ? "0 0 32px rgba(239,68,68,0.5), 0 8px 24px rgba(0,0,0,0.4)"
            : `0 0 32px rgba(34,211,238,0.4), 0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)`,
          cursor: isDisabled ? "not-allowed" : "pointer",
          opacity: isDisabled ? 0.5 : 1,
        }}
        whileHover={!isDisabled ? { scale: 1.05 } : {}}
        whileTap={!isDisabled ? { scale: 0.92, y: 3 } : {}}
      >
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 rounded-full"
          style={{ width: "55%", height: 4, background: "rgba(255,255,255,0.3)" }} />
        {isListening
          ? <MicOff size={28} className="text-white" strokeWidth={2} />
          : <Mic    size={28} className="text-white" strokeWidth={2} />}
      </motion.button>
    </div>
  );
}
