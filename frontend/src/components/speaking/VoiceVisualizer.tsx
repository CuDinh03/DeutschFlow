"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { SessionState, CYAN, PURPLE } from "./types";

const BAR_COLORS = ["#22D3EE", "#38BDF8", "#818CF8", "#A78BFA", "#818CF8", "#38BDF8", "#22D3EE"];
const BASE_AMPLITUDES = [0.32, 0.54, 0.72, 1.0, 0.72, 0.54, 0.32];
const BAR_COUNT = BAR_COLORS.length;

interface Props {
  state: SessionState;
  /** Live AnalyserNode from MediaStream — when provided, bars use real frequency data */
  analyser?: AnalyserNode | null;
}

export function VoiceVisualizer({ state, analyser }: Props) {
  const isActive     = state === "listening" || state === "ai-speaking";
  const isAI         = state === "ai-speaking";
  const isProcessing = state === "processing";

  // Real-time bar heights from analyser (0–255, normalised to 0–1)
  const [realBars, setRealBars] = useState<number[]>(Array(BAR_COUNT).fill(0));
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!analyser) {
      setRealBars(Array(BAR_COUNT).fill(0));
      return;
    }
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      // Sample evenly across the frequency bins
      const step = Math.floor(data.length / BAR_COUNT);
      setRealBars(
        Array.from({ length: BAR_COUNT }, (_, i) => (data[i * step] ?? 0) / 255)
      );
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center">
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 180, height: 80,
            background: isActive
              ? `radial-gradient(ellipse, ${isAI ? "rgba(167,139,250,0.35)" : "rgba(34,211,238,0.35)"} 0%, transparent 70%)`
              : "transparent",
            filter: "blur(20px)",
          }}
          animate={{ opacity: isActive ? [0.5, 1, 0.5] : 0 }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />

        <div className="flex items-end justify-center gap-[5px] relative z-10" style={{ height: 80 }}>
          {BAR_COLORS.map((color, i) => {
            const baseH = BASE_AMPLITUDES[i] * 32;
            const realH = analyser && state === "listening"
              ? Math.max(4, realBars[i] * 80)
              : null;

            return (
              <motion.div
                key={i}
                className="rounded-full flex-shrink-0"
                style={{
                  width: 6,
                  background: `linear-gradient(180deg, ${color}, ${color}88)`,
                  boxShadow: isActive ? `0 0 10px ${color}90, 0 0 20px ${color}50` : "none",
                  originY: 1,
                  // When we have real data, bypass Framer Motion animation
                  height: realH ?? undefined,
                }}
                animate={realH !== null ? undefined : (
                  isProcessing
                    ? { height: [baseH * 0.3, baseH * 0.5, baseH * 0.3] }
                    : isActive
                    ? isAI
                      ? { height: [baseH * 0.9, baseH * 2.2, baseH * 1.2, baseH * 2.8, baseH * 0.9] }
                      : { height: [baseH, baseH * 3.2, baseH * 1.4, baseH * 2.6, baseH] }
                    : { height: [baseH * 0.4, baseH * 0.7, baseH * 0.4] }
                )}
                transition={{
                  duration: isActive ? (isAI ? 1.1 : 0.65) : 1.8,
                  repeat: Infinity,
                  repeatType: "mirror",
                  ease: "easeInOut",
                  delay: i * (isActive ? 0.06 : 0.15),
                }}
              />
            );
          })}
        </div>
      </div>

      <motion.div
        key={state}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2"
      >
        {isProcessing ? (
          <motion.div
            className="w-3 h-3 rounded-full border-2"
            style={{ borderColor: CYAN, borderTopColor: "transparent" }}
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          />
        ) : (
          <motion.div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: isActive ? (isAI ? PURPLE : CYAN) : "rgba(255,255,255,0.3)" }}
            animate={{ opacity: isActive ? [1, 0.3, 1] : 1 }}
            transition={{ duration: 0.9, repeat: Infinity }}
          />
        )}
        <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>
          {state === "idle"        && "Bereit zum Sprechen"}
          {state === "listening"   && "Aufnahme läuft..."}
          {state === "processing"  && "KI analysiert..."}
          {state === "ai-speaking" && "KI antwortet..."}
          {state === "sending"     && "Nachricht wird gesendet..."}
        </span>
      </motion.div>
    </div>
  );
}
