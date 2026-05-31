"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PersonaAvatar } from "./PersonaAvatar";
import type { PersonaReaction } from "@/hooks/usePersonaReaction";

interface Props {
  personaId: string | null | undefined;
  reaction: PersonaReaction;
  visible?: boolean;
}

// Reaction → small overlay glyph. `talking` and `idle` stay clean to avoid
// drawing attention away from the message stream.
const REACTION_LABEL: Record<PersonaReaction, string> = {
  idle: "",
  listening: "👂",
  talking: "",
  thinking: "💭",
  concerned: "🤔",
};

// Ring color hint per reaction — picked up by the breathing halo.
const REACTION_RING: Record<PersonaReaction, string> = {
  idle: "rgba(255,255,255,0.18)",
  listening: "rgba(56,189,248,0.65)",   // cyan
  talking: "rgba(168,85,247,0.55)",     // violet
  thinking: "rgba(251,191,36,0.55)",    // amber
  concerned: "rgba(248,113,113,0.55)",  // red
};

export function SpeakingPersonaFloat({ personaId, reaction, visible = true }: Props) {
  const reduceMotion = useReducedMotion();
  const badge = REACTION_LABEL[reaction];
  const ring = REACTION_RING[reaction];
  const isActive = reaction !== "idle";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          // Bottom-left, small, sticky to the scroll area's lower corner.
          // Sized so the cartoon stays well clear of message bubbles on the right.
          className="sticky bottom-3 left-3 z-10 flex flex-col items-start gap-1 w-fit pointer-events-none"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden
        >
          {/* Reaction emoji badge — small, only when something is happening */}
          <AnimatePresence mode="wait">
            {badge && (
              <motion.span
                key={reaction}
                className="text-sm leading-none pl-1"
                initial={{ opacity: 0, scale: 0.4, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.4, y: 4 }}
                transition={{ duration: 0.18 }}
              >
                {badge}
              </motion.span>
            )}
          </AnimatePresence>

          {/* Round avatar with breathing reaction halo */}
          <div className="relative">
            {/* Pulsing halo behind the avatar — color reflects the reaction */}
            <AnimatePresence>
              {isActive && !reduceMotion && (
                <motion.span
                  key={reaction}
                  className="absolute inset-0 rounded-full"
                  style={{ background: ring, filter: "blur(8px)" }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: [0.5, 0.85, 0.5], scale: [1, 1.18, 1] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
            </AnimatePresence>

            <PersonaAvatar
              personaId={personaId}
              reaction={reaction}
              // Compact round chat-head: ~56px, fits like a Messenger bubble.
              className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-white/25 shadow-[0_6px_20px_rgba(0,0,0,0.35)]"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
