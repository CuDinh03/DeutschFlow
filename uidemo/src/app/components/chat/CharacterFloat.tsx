// ─────────────────────────────────────────────────────────────────────────────
// DeutschFlow · CharacterFloat
// Wrapper that handles the character's:
//   • Entrance slide-in from right
//   • Idle floating (bob up/down)
//   • Talking body-squash animation
//   • Ground shadow
//
// Accepts any character component through the `CharComponent` prop.
// ─────────────────────────────────────────────────────────────────────────────

import { motion, AnimatePresence } from "motion/react";
import { PersonaToken } from "../../lib/personas";

interface CharacterFloatProps {
  /** The character React component (LukasCharacter or EmmaCharacter) */
  CharComponent: React.ComponentType<{ expression: any; isTalking?: boolean; style?: React.CSSProperties }>;
  /** Current expression string — typed as `never` at call site to bypass strict union types */
  expression: string;
  /** Whether the AI is actively speaking (drives bob speed + body squash) */
  isTalking: boolean;
  /** Whether the character has entered the screen yet */
  entered: boolean;
  /** Persona token — used for glow color */
  persona: PersonaToken;
}

export function CharacterFloat({
  CharComponent,
  expression,
  isTalking,
  entered,
  persona,
}: CharacterFloatProps) {
  return (
    <AnimatePresence>
      {entered && (
        <motion.div
          className="absolute bottom-0 right-0 pointer-events-none"
          style={{ width: 200, zIndex: 5 }}
          initial={{ x: 220, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 220, opacity: 0 }}
          transition={{ type: "spring", stiffness: 160, damping: 22, delay: 0.1 }}
        >
          {/* Floating idle / fast bob when talking */}
          <motion.div
            animate={{ y: isTalking ? [0, -4, 0] : [0, -10, 0] }}
            transition={{
              duration: isTalking ? 0.35 : 3.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            {/* Body squash when talking */}
            <motion.div
              animate={isTalking ? { scaleY: [1, 1.016, 1, 0.99, 1] } : { scaleY: 1 }}
              transition={{
                duration: 0.22,
                repeat: isTalking ? Infinity : 0,
              }}
            >
              <CharComponent
                expression={expression as never}
                isTalking={isTalking}
                style={{ opacity: 0.95 }}
              />
            </motion.div>
          </motion.div>

          {/* Glow beneath feet */}
          <motion.div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-28 h-8 rounded-full pointer-events-none"
            style={{ background: persona.glow, filter: "blur(18px)" }}
            animate={{ opacity: isTalking ? [0.5, 0.8, 0.5] : [0.3, 0.5, 0.3] }}
            transition={{ duration: isTalking ? 0.4 : 2.5, repeat: Infinity }}
          />

          {/* Ground shadow */}
          <div
            className="w-28 h-4 mx-auto rounded-full"
            style={{
              background: "rgba(0,0,0,0.35)",
              filter: "blur(8px)",
              marginTop: -8,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
