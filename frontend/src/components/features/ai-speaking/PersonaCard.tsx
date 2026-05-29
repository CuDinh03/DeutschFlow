import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { spring } from "@/lib/motion";
import { PersonaToken } from "@/lib/personas";
import { LukasCharacter } from "@/components/speaking/characters/LukasCharacter";
import { EmmaCharacter } from "@/components/speaking/characters/EmmaCharacter";
import { KlausCharacter } from "@/components/speaking/characters/KlausCharacter";
import { AnnaCharacter } from "@/components/speaking/characters/AnnaCharacter";
import { LenaCharacter } from "@/components/speaking/characters/LenaCharacter";
import { PetraCharacter } from "@/components/speaking/characters/PetraCharacter";
import { TuanCharacter } from "@/components/speaking/characters/TuanCharacter";
import { LanCharacter } from "@/components/speaking/characters/LanCharacter";
import { MaxCharacter } from "@/components/speaking/characters/MaxCharacter";
import { OliverCharacter } from "@/components/speaking/characters/OliverCharacter";
import { NiklasCharacter } from "@/components/speaking/characters/NiklasCharacter";
import { NinaCharacter } from "@/components/speaking/characters/NinaCharacter";
import { SchneiderCharacter } from "@/components/speaking/characters/SchneiderCharacter";
import { WeberCharacter } from "@/components/speaking/characters/WeberCharacter";
import { ThomasCharacter } from "@/components/speaking/characters/ThomasCharacter";
import { SarahCharacter } from "@/components/speaking/characters/SarahCharacter";
import { HannieCharacter } from "@/components/speaking/characters/HannieCharacter";
import { MinhCharacter } from "@/components/speaking/characters/MinhCharacter";

interface PersonaCardProps {
  persona: PersonaToken;
  isSelected: boolean;
  index: number;
  onClick: () => void;
}

const SVG_PERSONAS = new Set([
  "lukas", "emma", "klaus", "anna", "lena", "petra", "tuan", "lan",
  "max", "oliver", "niklas", "nina", "schneider", "weber",
  "thomas", "sarah", "hannie", "minh",
]);

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
  } else if (persona.id === "anna") {
    CharComponent = AnnaCharacter as React.ComponentType<CharProps>;
    expression = isSelected ? "laughing" : "idle";
  } else if (persona.id === "lena") {
    CharComponent = LenaCharacter as React.ComponentType<CharProps>;
    expression = isSelected ? "smiling" : "idle";
  } else if (persona.id === "petra") {
    CharComponent = PetraCharacter as React.ComponentType<CharProps>;
    expression = isSelected ? "serious" : "idle";
  } else if (persona.id === "tuan") {
    CharComponent = TuanCharacter as React.ComponentType<CharProps>;
    expression = isSelected ? "smiling" : "neutral";
  } else if (persona.id === "lan") {
    CharComponent = LanCharacter as React.ComponentType<CharProps>;
    expression = isSelected ? "laughing" : "idle";
  } else if (persona.id === "max") {
    CharComponent = MaxCharacter as React.ComponentType<CharProps>;
    expression = isSelected ? "serious" : "neutral";
  } else if (persona.id === "oliver") {
    CharComponent = OliverCharacter as React.ComponentType<CharProps>;
    expression = isSelected ? "thinking" : "neutral";
  } else if (persona.id === "niklas") {
    CharComponent = NiklasCharacter as React.ComponentType<CharProps>;
    expression = isSelected ? "smiling" : "neutral";
  } else if (persona.id === "nina") {
    CharComponent = NinaCharacter as React.ComponentType<CharProps>;
    expression = isSelected ? "winking" : "idle";
  } else if (persona.id === "schneider") {
    CharComponent = SchneiderCharacter as React.ComponentType<CharProps>;
    expression = isSelected ? "serious" : "neutral";
  } else if (persona.id === "weber") {
    CharComponent = WeberCharacter as React.ComponentType<CharProps>;
    expression = isSelected ? "thinking" : "neutral";
  } else if (persona.id === "thomas") {
    CharComponent = ThomasCharacter as React.ComponentType<CharProps>;
    expression = isSelected ? "smiling" : "neutral";
  } else if (persona.id === "sarah") {
    CharComponent = SarahCharacter as React.ComponentType<CharProps>;
    expression = isSelected ? "smiling" : "idle";
  } else if (persona.id === "hannie") {
    CharComponent = HannieCharacter as React.ComponentType<CharProps>;
    expression = isSelected ? "winking" : "idle";
  } else if (persona.id === "minh") {
    CharComponent = MinhCharacter as React.ComponentType<CharProps>;
    expression = isSelected ? "smiling" : "neutral";
  }

  return (
    <motion.button
      className="flex flex-col rounded-[var(--radius-xl)] overflow-hidden relative cursor-pointer text-left"
      style={{
        width: "100%",
        height: hasSvg ? 380 : 320,
        background: isSelected
          ? `linear-gradient(180deg, ${persona.bg} 0%, rgba(10,10,28,0.92) 100%)`
          : "rgba(20,20,42,0.9)",
        border: `2px solid ${isSelected ? persona.accent : "rgba(255,255,255,0.07)"}`,
        boxShadow: isSelected
          ? `0 0 32px ${persona.glow}, 0 0 8px ${persona.glow}, inset 0 0 32px ${persona.bg}`
          : "0 2px 12px rgba(0,0,0,0.35)",
      }}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, ...spring.gentle }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
    >
      <AnimatePresence>
        {isSelected && (
          <motion.div
            className="absolute inset-0 rounded-[var(--radius-xl)] pointer-events-none"
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
          ) : null}
        </motion.div>
      </div>

      {/* ── Card info ────────────────────────────────────────────── */}
      <div
        className="px-4 pb-5 pt-3 w-full"
        style={{
          background: "linear-gradient(0deg, rgba(10,10,28,0.97) 55%, rgba(10,10,28,0))",
          backdropFilter: "blur(12px) saturate(160%)",
          WebkitBackdropFilter: "blur(12px) saturate(160%)",
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
            transition={spring.snappy}
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
