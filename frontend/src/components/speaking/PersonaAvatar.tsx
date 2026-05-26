"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { normalizeSpeakingPersona, type SpeakingPersonaVisualId } from "./personaTheme";
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
  /** True while assistant is active — lip-sync + pulsing aura */
  isTalking?: boolean;
  className?: string;
}

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

export function PersonaAvatar({ personaId, isTalking, className }: Props) {
  const reduceMotion = useReducedMotion();
  const id: SpeakingPersonaVisualId = normalizeSpeakingPersona(personaId ?? undefined);

  const auraRgb =
    id === "EMMA"
      ? "251, 191, 36"
      : id === "LUKAS"
        ? "56, 189, 248"
        : id === "ANNA"
          ? "45, 212, 191"
          : id === "KLAUS"
            ? "185, 28, 28"
            : id === "ANNA"
              ? "245, 158, 11"
              : id === "LENA"
                ? "16, 185, 129"
                : id === "PETRA"
                  ? "220, 38, 38"
                  : id === "TUAN"
                    ? "245, 158, 11"
                    : id === "LAN"
                      ? "167, 139, 250"
                      : id === "MAX"
                        ? "234, 179, 8"
                        : id === "OLIVER"
                          ? "99, 102, 241"
                          : id === "NIKLAS"
                            ? "20, 184, 166"
                            : id === "NINA"
                              ? "244, 114, 182"
                              : id === "SCHNEIDER"
                                ? "59, 130, 246"
                                : id === "WEBER"
                                  ? "236, 72, 153"
                                  : id === "THOMAS"
                                    ? "234, 179, 8"
                                    : id === "HANNIE"
                                      ? "56, 189, 248"
                                      : id === "SARAH"
                                        ? "184, 59, 94"
                                        : id === "MINH"
                                          ? "239, 68, 68"
                                          : "34, 211, 238";

  const expressionTalking = isTalking ?? false;

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
        animate={reduceMotion ? undefined : { y: expressionTalking ? [0, -4, 0] : [0, -8, 0] }}
        transition={{
          duration: expressionTalking ? 0.38 : 3.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <motion.div
          className="relative rounded-[2rem] p-1"
          animate={
            reduceMotion || !expressionTalking
              ? { boxShadow: "0 14px 44px rgba(0,0,0,0.38)" }
              : {
                  boxShadow: [
                    `0 14px 44px rgba(0,0,0,0.38), 0 0 0 0 rgba(${auraRgb},0.35)`,
                    `0 18px 52px rgba(0,0,0,0.42), 0 0 28px 8px rgba(${auraRgb},0.35)`,
                    `0 14px 44px rgba(0,0,0,0.38), 0 0 0 0 rgba(${auraRgb},0.35)`,
                  ],
                }
          }
          transition={
            reduceMotion || !expressionTalking
              ? { duration: 0 }
              : { duration: 1.35, repeat: Infinity, ease: "easeInOut" }
          }
        >
          <div
            className={cn(
              "rounded-[1.75rem] bg-gradient-to-b from-white/12 to-white/[0.04] border border-white/18 backdrop-blur-md overflow-hidden shadow-inner shadow-white/5",
              id !== "DEFAULT" && "p-0",
            )}
          >
            {id !== "DEFAULT" ? (
              <div className="w-full aspect-[280/500] max-h-[min(48vh,400px)] min-h-0">
                {id === "LUKAS" ? (
                  <LukasCharacter expression={expressionTalking ? "talking" : "neutral"} isTalking={expressionTalking} className="h-full w-full drop-shadow-xl" />
                ) : id === "EMMA" ? (
                  <EmmaCharacter expression={expressionTalking ? "talking" : "idle"} isTalking={expressionTalking} className="h-full w-full drop-shadow-xl" />
                ) : id === "ANNA" ? (
                  <HannaCharacter expression={expressionTalking ? "talking" : "neutral"} isTalking={expressionTalking} className="h-full w-full drop-shadow-xl" />
                ) : id === "KLAUS" ? (
                  <KlausCharacter expression={expressionTalking ? "talking" : "neutral"} isTalking={expressionTalking} className="h-full w-full drop-shadow-xl" />
                ) : id === "ANNA" ? (
                  <AnnaCharacter expression={expressionTalking ? "talking" : "idle"} isTalking={expressionTalking} className="h-full w-full drop-shadow-xl" />
                ) : id === "LENA" ? (
                  <LenaCharacter expression={expressionTalking ? "talking" : "idle"} isTalking={expressionTalking} className="h-full w-full drop-shadow-xl" />
                ) : id === "PETRA" ? (
                  <PetraCharacter expression={expressionTalking ? "talking" : "idle"} isTalking={expressionTalking} className="h-full w-full drop-shadow-xl" />
                ) : id === "TUAN" ? (
                  <TuanCharacter expression={expressionTalking ? "talking" : "neutral"} isTalking={expressionTalking} className="h-full w-full drop-shadow-xl" />
                ) : id === "LAN" ? (
                  <LanCharacter expression={expressionTalking ? "talking" : "idle"} isTalking={expressionTalking} className="h-full w-full drop-shadow-xl" />
                ) : id === "MAX" ? (
                  <MaxCharacter expression={expressionTalking ? "talking" : "neutral"} isTalking={expressionTalking} className="h-full w-full drop-shadow-xl" />
                ) : id === "OLIVER" ? (
                  <OliverCharacter expression={expressionTalking ? "talking" : "neutral"} isTalking={expressionTalking} className="h-full w-full drop-shadow-xl" />
                ) : id === "NIKLAS" ? (
                  <NiklasCharacter expression={expressionTalking ? "talking" : "neutral"} isTalking={expressionTalking} className="h-full w-full drop-shadow-xl" />
                ) : id === "NINA" ? (
                  <NinaCharacter expression={expressionTalking ? "talking" : "idle"} isTalking={expressionTalking} className="h-full w-full drop-shadow-xl" />
                ) : id === "SCHNEIDER" ? (
                  <SchneiderCharacter expression={expressionTalking ? "talking" : "neutral"} isTalking={expressionTalking} className="h-full w-full drop-shadow-xl" />
                ) : id === "THOMAS" ? (
                  <ThomasCharacter expression={expressionTalking ? "talking" : "neutral"} isTalking={expressionTalking} className="h-full w-full drop-shadow-xl" />
                ) : id === "HANNIE" ? (
                  <HannieCharacter expression={expressionTalking ? "talking" : "idle"} isTalking={expressionTalking} className="h-full w-full drop-shadow-xl" />
                ) : id === "SARAH" ? (
                  <SarahCharacter expression={expressionTalking ? "talking" : "idle"} isTalking={expressionTalking} className="h-full w-full drop-shadow-xl" />
                ) : id === "MINH" ? (
                  <MinhCharacter expression={expressionTalking ? "talking" : "neutral"} isTalking={expressionTalking} className="h-full w-full drop-shadow-xl" />
                ) : (
                  <WeberCharacter expression={expressionTalking ? "talking" : "idle"} isTalking={expressionTalking} className="h-full w-full drop-shadow-xl" />
                )}
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
