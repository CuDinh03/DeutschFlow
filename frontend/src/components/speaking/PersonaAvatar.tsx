"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { normalizeSpeakingPersona, type SpeakingPersonaVisualId } from "./personaTheme";
import type { PersonaReaction } from "@/hooks/usePersonaReaction";
import { AnnaCharacter } from "./characters/AnnaCharacter";
import { EmmaCharacter } from "./characters/EmmaCharacter";
import { HannaCharacter } from "./characters/HannaCharacter";
import { KlausCharacter } from "./characters/KlausCharacter";
import { LanCharacter } from "./characters/LanCharacter";
import { LenaCharacter } from "./characters/LenaCharacter";
import { LukasCharacter } from "./characters/LukasCharacter";
import { MaxCharacter } from "./characters/MaxCharacter";
import { NiklasCharacter } from "./characters/NiklasCharacter";
import { NinaCharacter } from "./characters/NinaCharacter";
import { OliverCharacter } from "./characters/OliverCharacter";
import { PetraCharacter } from "./characters/PetraCharacter";
import { SchneiderCharacter } from "./characters/SchneiderCharacter";
import { ThomasCharacter } from "./characters/ThomasCharacter";
import { TuanCharacter } from "./characters/TuanCharacter";
import { WeberCharacter } from "./characters/WeberCharacter";
import { SarahCharacter } from "./characters/SarahCharacter";
import { MinhCharacter } from "./characters/MinhCharacter";
import { HannieCharacter } from "./characters/HannieCharacter";

interface Props {
  personaId?: string | null;
  /** Deprecated: use `reaction` instead. Kept for backward compat. */
  isTalking?: boolean;
  /** Drives expression + animation. Overrides isTalking when provided. */
  reaction?: PersonaReaction;
  className?: string;
}

// Characters whose idle expression is "neutral" (vs "idle")
const NEUTRAL_GROUP = new Set<SpeakingPersonaVisualId>([
  "LUKAS", "ANNA", "KLAUS", "TUAN", "MAX", "OLIVER", "NIKLAS", "SCHNEIDER",
]);

function resolveExpression(
  id: SpeakingPersonaVisualId,
  reaction: PersonaReaction,
): string {
  const idleExpr = NEUTRAL_GROUP.has(id) ? "neutral" : "idle";
  switch (reaction) {
    case "talking":   return "talking";
    case "thinking":
    case "concerned": return "thinking";
    case "listening":
    case "idle":
    default:          return idleExpr;
  }
}

interface AnimParams {
  bobY: number[];
  bobDuration: number;
  auraActive: boolean;
  auraRgb: string;
  auraDuration: number;
}

function resolveAnim(reaction: PersonaReaction, personaAuraRgb: string): AnimParams {
  switch (reaction) {
    case "talking":
      return { bobY: [0, -4, 0], bobDuration: 0.38, auraActive: true, auraRgb: personaAuraRgb, auraDuration: 1.35 };
    case "thinking":
    case "concerned":
      return { bobY: [0, -6, 0], bobDuration: 4, auraActive: true, auraRgb: "245, 158, 11", auraDuration: 2.0 };
    case "listening":
      return { bobY: [0, -5, 0], bobDuration: 2.5, auraActive: true, auraRgb: "34, 211, 238", auraDuration: 1.8 };
    case "idle":
    default:
      return { bobY: [0, -8, 0], bobDuration: 3.5, auraActive: false, auraRgb: "0,0,0", auraDuration: 0 };
  }
}

const PERSONA_AURA_RGB: Record<SpeakingPersonaVisualId, string> = {
  EMMA:      "251, 191, 36",
  LUKAS:     "56, 189, 248",
  ANNA:      "45, 212, 191",
  KLAUS:     "185, 28, 28",
  LENA:      "16, 185, 129",
  PETRA:     "220, 38, 38",
  TUAN:      "245, 158, 11",
  LAN:       "167, 139, 250",
  MAX:       "234, 179, 8",
  OLIVER:    "99, 102, 241",
  NIKLAS:    "20, 184, 166",
  NINA:      "244, 114, 182",
  SCHNEIDER: "59, 130, 246",
  WEBER:     "236, 72, 153",
  THOMAS:    "234, 179, 8",
  HANNIE:    "56, 189, 248",
  SARAH:     "184, 59, 94",
  MINH:      "239, 68, 68",
  DEFAULT:   "34, 211, 238",
};

function NeutralFigure({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 140" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <ellipse cx="60" cy="118" rx="34" ry="9" fill="rgba(15,23,42,0.35)" />
      <rect x="28" y="32" width="64" height="56" rx="18" fill="url(#bot-body)" stroke="rgba(34,211,238,0.35)" strokeWidth="1.5" />
      <circle cx="46" cy="56" r="6" fill="#22d3ee" opacity="0.9" />
      <circle cx="74" cy="56" r="6" fill="#a78bfa" opacity="0.9" />
      <rect x="44" y="96" width="32" height="22" rx="8" fill="rgba(15,23,42,0.85)" stroke="rgba(255,255,255,0.12)" />
      <defs>
        <linearGradient id="bot-body" x1="28" y1="32" x2="92" y2="88">
          <stop stopColor="#1e293b" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function PersonaAvatar({ personaId, isTalking, reaction, className }: Props) {
  const reduceMotion = useReducedMotion();
  const id: SpeakingPersonaVisualId = normalizeSpeakingPersona(personaId ?? undefined);

  const activeReaction: PersonaReaction = reaction ?? (isTalking ? "talking" : "idle");
  const expr = resolveExpression(id, activeReaction);
  const isTalkingNow = activeReaction === "talking";
  const anim = resolveAnim(activeReaction, PERSONA_AURA_RGB[id] ?? PERSONA_AURA_RGB.DEFAULT);

  return (
    <motion.div
      className={cn(
        "pointer-events-none select-none flex flex-col justify-end",
        "w-[min(52vw,240px)] sm:w-[260px]",
        className,
      )}
      initial={reduceMotion ? false : { opacity: 0, x: 48 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        animate={reduceMotion ? undefined : { y: anim.bobY }}
        transition={{ duration: anim.bobDuration, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.div
          className="relative rounded-[2rem] p-1"
          animate={
            reduceMotion || !anim.auraActive
              ? { boxShadow: "0 14px 44px rgba(0,0,0,0.38)" }
              : {
                  boxShadow: [
                    `0 14px 44px rgba(0,0,0,0.38), 0 0 0 0 rgba(${anim.auraRgb},0.3)`,
                    `0 18px 52px rgba(0,0,0,0.42), 0 0 28px 8px rgba(${anim.auraRgb},0.3)`,
                    `0 14px 44px rgba(0,0,0,0.38), 0 0 0 0 rgba(${anim.auraRgb},0.3)`,
                  ],
                }
          }
          transition={
            reduceMotion || !anim.auraActive
              ? { duration: 0 }
              : { duration: anim.auraDuration, repeat: Infinity, ease: "easeInOut" }
          }
        >
          <div
            className={cn(
              "rounded-[1.75rem] bg-gradient-to-b from-white/12 to-white/[0.04] border border-white/18 backdrop-blur-md overflow-hidden shadow-inner shadow-white/5",
              id !== "DEFAULT" && "p-0",
            )}
          >
            {id !== "DEFAULT" ? (
              <div className="w-full aspect-[280/360] max-h-[min(48vh,360px)] min-h-0 overflow-hidden">
                <div className="w-full aspect-[280/500]">
                  {id === "LUKAS" ? (
                    <LukasCharacter expression={expr as never} isTalking={isTalkingNow} className="h-full w-full drop-shadow-xl" />
                  ) : id === "EMMA" ? (
                    <EmmaCharacter expression={expr as never} isTalking={isTalkingNow} className="h-full w-full drop-shadow-xl" />
                  ) : id === "ANNA" ? (
                    <HannaCharacter expression={expr as never} isTalking={isTalkingNow} className="h-full w-full drop-shadow-xl" />
                  ) : id === "KLAUS" ? (
                    <KlausCharacter expression={expr as never} isTalking={isTalkingNow} className="h-full w-full drop-shadow-xl" />
                  ) : id === "LENA" ? (
                    <LenaCharacter expression={expr as never} isTalking={isTalkingNow} className="h-full w-full drop-shadow-xl" />
                  ) : id === "PETRA" ? (
                    <PetraCharacter expression={expr as never} isTalking={isTalkingNow} className="h-full w-full drop-shadow-xl" />
                  ) : id === "TUAN" ? (
                    <TuanCharacter expression={expr as never} isTalking={isTalkingNow} className="h-full w-full drop-shadow-xl" />
                  ) : id === "LAN" ? (
                    <LanCharacter expression={expr as never} isTalking={isTalkingNow} className="h-full w-full drop-shadow-xl" />
                  ) : id === "MAX" ? (
                    <MaxCharacter expression={expr as never} isTalking={isTalkingNow} className="h-full w-full drop-shadow-xl" />
                  ) : id === "OLIVER" ? (
                    <OliverCharacter expression={expr as never} isTalking={isTalkingNow} className="h-full w-full drop-shadow-xl" />
                  ) : id === "NIKLAS" ? (
                    <NiklasCharacter expression={expr as never} isTalking={isTalkingNow} className="h-full w-full drop-shadow-xl" />
                  ) : id === "NINA" ? (
                    <NinaCharacter expression={expr as never} isTalking={isTalkingNow} className="h-full w-full drop-shadow-xl" />
                  ) : id === "SCHNEIDER" ? (
                    <SchneiderCharacter expression={expr as never} isTalking={isTalkingNow} className="h-full w-full drop-shadow-xl" />
                  ) : id === "THOMAS" ? (
                    <ThomasCharacter expression={expr as never} isTalking={isTalkingNow} className="h-full w-full drop-shadow-xl" />
                  ) : id === "HANNIE" ? (
                    <HannieCharacter expression={expr as never} isTalking={isTalkingNow} className="h-full w-full drop-shadow-xl" />
                  ) : id === "SARAH" ? (
                    <SarahCharacter expression={expr as never} isTalking={isTalkingNow} className="h-full w-full drop-shadow-xl" />
                  ) : id === "MINH" ? (
                    <MinhCharacter expression={expr as never} isTalking={isTalkingNow} className="h-full w-full drop-shadow-xl" />
                  ) : (
                    <WeberCharacter expression={expr as never} isTalking={isTalkingNow} className="h-full w-full drop-shadow-xl" />
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 flex items-center justify-center">
                <NeutralFigure className="w-28 h-auto sm:w-32 drop-shadow-xl" />
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
