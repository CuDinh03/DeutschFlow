// ─────────────────────────────────────────────────────────────────────────────
// DeutschFlow · PersonaCard
// Main Component for companion selection cards.
//
// States (driven by `isSelected` prop):
//   default  — Dark card, subtle border
//   selected — Glowing border, color tint bg, character floating, check badge
// ─────────────────────────────────────────────────────────────────────────────

import { motion, AnimatePresence } from "motion/react";
import { PersonaToken } from "../../lib/personas";
import { LukasCharacter } from "../characters/LukasCharacter";
import { EmmaCharacter } from "../characters/EmmaCharacter";

interface PersonaCardProps {
  persona: PersonaToken;
  isSelected: boolean;
  /** Card stagger index for entrance animation */
  index: number;
  onClick: () => void;
}

export function PersonaCard({ persona, isSelected, index, onClick }: PersonaCardProps) {
  const CharComponent =
    persona.id === "lukas" ? LukasCharacter : EmmaCharacter;

  // Expression changes based on selection state
  const expression = isSelected
    ? persona.id === "lukas"
      ? "smiling"
      : "winking"
    : persona.id === "lukas"
    ? "neutral"
    : "idle";

  return (
    <motion.button
      className="flex-1 flex flex-col rounded-[24px] overflow-hidden relative cursor-pointer text-left"
      style={{
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
      transition={{ delay: index * 0.12, type: "spring", stiffness: 260, damping: 24 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
    >
      {/* ── Selected glow ring pulse ──────────────────────────────── */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            className="absolute inset-0 rounded-[22px] pointer-events-none"
            style={{ border: `2px solid ${persona.accent}` }}
            initial={{ opacity: 0.5, scale: 1 }}
            animate={{ opacity: [0.5, 0.15, 0.5], scale: [1, 1.01, 1] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>

      {/* ── Character illustration ────────────────────────────────── */}
      <div className="flex-1 relative flex items-end justify-center pt-4 px-2">
        {/* Glow beneath character */}
        <AnimatePresence>
          {isSelected && (
            <motion.div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-24 rounded-full"
              style={{ background: persona.glow, filter: "blur(30px)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>

        {/* Float animation */}
        <motion.div
          className="w-full"
          animate={isSelected ? { y: [0, -6, 0] } : { y: 0 }}
          transition={
            isSelected
              ? { duration: 2.8, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.3 }
          }
        >
          <CharComponent
            expression={expression as never}
            style={{ height: 240 }}
          />
        </motion.div>
      </div>

      {/* ── Card info ────────────────────────────────────────────── */}
      <div
        className="px-4 pb-5 pt-3"
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
          className="text-[11px] leading-relaxed"
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
