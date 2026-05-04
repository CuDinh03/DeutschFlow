"use client";

/**
 * UIDemo `CharacterFloat` — persona illustration bottom-right with entrance + bob + talking squash + glow.
 */
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LukasCharacter } from "./characters/LukasCharacter";
import { EmmaCharacter } from "./characters/EmmaCharacter";
import { HannaCharacter } from "./characters/HannaCharacter";
import type { SpeakingPersonaVisualId } from "./personaTheme";

interface Props {
  personaId: SpeakingPersonaVisualId;
  isTalking: boolean;
  entered: boolean;
  glow: string;
}

export function SpeakingCharacterFloat({ personaId, isTalking, entered, glow }: Props) {
  const reduceMotion = useReducedMotion();

  const Char =
    personaId === "LUKAS"
      ? LukasCharacter
      : personaId === "EMMA"
        ? EmmaCharacter
        : personaId === "HANNA"
          ? HannaCharacter
          : LukasCharacter;

  const expression =
    personaId === "EMMA"
      ? isTalking
        ? ("talking" as const)
        : ("idle" as const)
      : isTalking
        ? ("talking" as const)
        : ("neutral" as const);

  return (
    <AnimatePresence>
      {entered && (
        <motion.div
          className="pointer-events-none absolute bottom-0 right-0"
          style={{ width: 200, zIndex: 5 }}
          initial={reduceMotion ? false : { x: 220, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 220, opacity: 0 }}
          transition={{ type: "spring", stiffness: 160, damping: 22, delay: 0.1 }}
        >
          <motion.div
            animate={reduceMotion ? undefined : { y: isTalking ? [0, -4, 0] : [0, -10, 0] }}
            transition={{
              duration: isTalking ? 0.35 : 3.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <motion.div
              animate={
                reduceMotion || !isTalking ? { scaleY: 1 } : { scaleY: [1, 1.016, 1, 0.99, 1] }
              }
              transition={{ duration: 0.22, repeat: isTalking ? Infinity : 0 }}
            >
              <Char expression={expression as never} isTalking={isTalking} style={{ opacity: 0.95 }} />
            </motion.div>
          </motion.div>

          <motion.div
            className="pointer-events-none absolute bottom-0 left-1/2 h-8 w-28 -translate-x-1/2 rounded-full"
            style={{ background: glow, filter: "blur(18px)" }}
            animate={{ opacity: isTalking ? [0.5, 0.8, 0.5] : [0.3, 0.5, 0.3] }}
            transition={{ duration: isTalking ? 0.4 : 2.5, repeat: Infinity }}
          />

          <div
            className="mx-auto mt-[-8px] h-4 w-28 rounded-full"
            style={{
              background: "rgba(0,0,0,0.35)",
              filter: "blur(8px)",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
