"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotion } from "framer-motion";
import { PersonaAvatar } from "./PersonaAvatar";
import type { PersonaReaction } from "@/hooks/usePersonaReaction";

interface Props {
  personaId: string | null | undefined;
  reaction: PersonaReaction;
  visible?: boolean;
}

const REACTION_LABEL: Record<PersonaReaction, string> = {
  idle: "",
  listening: "👂",
  talking: "",
  thinking: "💭",
  concerned: "🤔",
};

export function SpeakingPersonaFloat({ personaId, reaction, visible = true }: Props) {
  const reduceMotion = useReducedMotion();
  const badge = REACTION_LABEL[reaction];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-1"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden
        >
          {/* reaction badge */}
          <AnimatePresence mode="wait">
            {badge && (
              <motion.span
                key={reaction}
                className="text-lg leading-none"
                initial={{ opacity: 0, scale: 0.5, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 4 }}
                transition={{ duration: 0.2 }}
              >
                {badge}
              </motion.span>
            )}
          </AnimatePresence>

          <PersonaAvatar
            personaId={personaId}
            reaction={reaction}
            className="w-[min(28vw,160px)] sm:w-[180px]"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
