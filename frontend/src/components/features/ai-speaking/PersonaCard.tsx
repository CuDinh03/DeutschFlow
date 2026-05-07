import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PersonaToken } from "@/lib/personas";
import { LukasCharacter } from "@/components/speaking/characters/LukasCharacter";
import { EmmaCharacter } from "@/components/speaking/characters/EmmaCharacter";
import { KlausCharacter } from "@/components/speaking/characters/KlausCharacter";
import Image from "next/image";

interface PersonaCardProps {
  persona: PersonaToken;
  isSelected: boolean;
  index: number;
  onClick: () => void;
}

const SVG_PERSONAS = new Set(["lukas", "emma", "klaus"]);

export function PersonaCard({ persona, isSelected, index, onClick }: PersonaCardProps) {
  type CharProps = { expression: string; isTalking: boolean; style?: React.CSSProperties; className?: string };

  let CharComponent: React.ComponentType<CharProps> | null = null;
  let expression = "idle";
  const hasSvg = SVG_PERSONAS.has(persona.id);

  if (persona.id === "lukas") {
    CharComponent = LukasCharacter as React.ComponentType<CharProps>;
    expression = isSelected ? "smiling" : "neutral";
  } else if (persona.id === "emma") {
    CharComponent = EmmaCharacter as React.ComponentType<CharProps>;
    expression = isSelected ? "winking" : "idle";
  } else if (persona.id === "klaus") {
    CharComponent = KlausCharacter as React.ComponentType<CharProps>;
    expression = isSelected ? "winking" : "idle";
  }

  return (
    <motion.button
      className="flex flex-col rounded-[20px] overflow-hidden relative cursor-pointer text-left"
      style={{
        width: "calc(50% - 6px)",
        height: hasSvg ? 380 : 320,
        background: isSelected
          ? `linear-gradient(180deg, ${persona.bg} 0%, rgba(10,10,28,0.92) 100%)`
          : "rgba(20,20,42,0.9)",
        border: `2px solid ${isSelected ? persona.accent : "rgba(255,255,255,0.07)"}`,
        boxShadow: isSelected
          ? `0 0 32px ${persona.glow}, 0 0 8px ${persona.glow}, inset 0 0 32px ${persona.bg}`
          : "none",
      }}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, type: "spring", stiffness: 260, damping: 24 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
    >
      <AnimatePresence>
        {isSelected && (
          <motion.div
            className="absolute inset-0 rounded-[18px] pointer-events-none"
            style={{ border: `2px solid ${persona.accent}` }}
            initial={{ opacity: 0.5, scale: 1 }}
            animate={{ opacity: [0.5, 0.15, 0.5], scale: [1, 1.01, 1] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>

      {/* ── Character illustration ── */}
      <div className="flex-1 relative flex items-end justify-center pt-4 px-2 overflow-hidden">
        <AnimatePresence>
          {isSelected && (
            <motion.div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-24 rounded-full"
              style={{ background: persona.glow, filter: "blur(30px)" }}
              initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>

        <motion.div
          className="w-full flex justify-center"
          animate={isSelected ? { y: [0, -6, 0] } : { y: 0 }}
          transition={isSelected ? { duration: 2.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
        >
          {hasSvg && CharComponent ? (
            <CharComponent
              expression={expression as never}
              isTalking={false}
              style={{ height: hasSvg ? 220 : 180, maxWidth: "100%", objectFit: "contain" }}
            />
          ) : (
            <Image
              src={`/companions/${persona.id}.png`}
              alt={persona.name}
              width={200} height={200}
              className="rounded-xl object-cover"
              style={{ height: 180, width: "auto", maxWidth: "100%" }}
            />
          )}
        </motion.div>
      </div>

      {/* ── Card info ────────────────────────────────────────────── */}
      <div
        className="px-4 pb-5 pt-3 w-full"
        style={{
          background: "linear-gradient(0deg, rgba(10,10,28,0.95) 60%, rgba(10,10,28,0))",
        }}
      >
        {/* Tag pill */}
        <span
          className="inline-block text-[10px] font-bold px-2.5 py-1 rounded-full mb-2"
          style={{ background: persona.tagBg, color: persona.accent }}
        >
          {persona.tag}
        </span>
        <p className="font-black text-lg text-white mb-0.5">{persona.name}</p>
        <p className="text-xs font-semibold mb-1.5" style={{ color: persona.accent }}>
          {persona.role}
        </p>
        <p
          className="text-[11px] leading-relaxed line-clamp-2"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          {persona.desc}
        </p>
      </div>

      {/* ── Checkmark badge ───────────────────────────────────────── */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: persona.accent }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M 2 7 L 6 11 L 12 4"
                stroke="white"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
