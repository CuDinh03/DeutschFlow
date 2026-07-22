"use client";

import { cn } from "@/lib/utils";
import { LukasCharacter } from "./characters/LukasCharacter";
import { EmmaCharacter } from "./characters/EmmaCharacter";
import { HannaCharacter } from "./characters/HannaCharacter";
import { KlausCharacter } from "./characters/KlausCharacter";
import { AnnaCharacter } from "./characters/AnnaCharacter";
import { LenaCharacter } from "./characters/LenaCharacter";
import { PetraCharacter } from "./characters/PetraCharacter";
import { TuanCharacter } from "./characters/TuanCharacter";
import { LanCharacter } from "./characters/LanCharacter";
import { MaxCharacter } from "./characters/MaxCharacter";
import { OliverCharacter } from "./characters/OliverCharacter";
import { NiklasCharacter } from "./characters/NiklasCharacter";
import { NinaCharacter } from "./characters/NinaCharacter";
import { SchneiderCharacter } from "./characters/SchneiderCharacter";
import { WeberCharacter } from "./characters/WeberCharacter";
import { ThomasCharacter } from "./characters/ThomasCharacter";
import { SarahCharacter } from "./characters/SarahCharacter";
import { HannieCharacter } from "./characters/HannieCharacter";
import { MinhCharacter } from "./characters/MinhCharacter";
import { normalizeSpeakingPersona, type SpeakingPersonaVisualId } from "./personaTheme";

interface Props {
  personaId: string | null | undefined;
  /** Mirrors UIDemo AIChat `getExpression` idle/smiling branch */
  chatBusy: boolean;
  className?: string;
}

export function SpeakingPersonaMiniAvatar({ personaId, chatBusy, className }: Props) {
  const id = normalizeSpeakingPersona(personaId ?? undefined);

  const exprLukas = chatBusy ? ("talking" as const) : ("neutral" as const);
  const exprEmma = chatBusy ? ("talking" as const) : ("idle" as const);
  const exprHanna = chatBusy ? ("talking" as const) : ("neutral" as const);
  const exprKlaus = chatBusy ? ("talking" as const) : ("neutral" as const);

  const inner = (pid: SpeakingPersonaVisualId) => {
    if (pid === "EMMA") return <EmmaCharacter expression={exprEmma} className="block h-[200px] w-[200px] max-w-none" />;
    if (pid === "KLAUS") return <KlausCharacter expression={exprKlaus} className="block h-[200px] w-[200px] max-w-none" />;
    if (pid === "ANNA") return <AnnaCharacter expression={chatBusy ? "talking" : "idle"} className="block h-[200px] w-[200px] max-w-none" />;
    if (pid === "LENA") return <LenaCharacter expression={chatBusy ? "talking" : "idle"} className="block h-[200px] w-[200px] max-w-none" />;
    if (pid === "PETRA") return <PetraCharacter expression={chatBusy ? "talking" : "idle"} className="block h-[200px] w-[200px] max-w-none" />;
    if (pid === "TUAN") return <TuanCharacter expression={chatBusy ? "talking" : "neutral"} className="block h-[200px] w-[200px] max-w-none" />;
    if (pid === "LAN") return <LanCharacter expression={chatBusy ? "talking" : "idle"} className="block h-[200px] w-[200px] max-w-none" />;
    if (pid === "MAX") return <MaxCharacter expression={chatBusy ? "talking" : "neutral"} className="block h-[200px] w-[200px] max-w-none" />;
    if (pid === "OLIVER") return <OliverCharacter expression={chatBusy ? "talking" : "neutral"} className="block h-[200px] w-[200px] max-w-none" />;
    if (pid === "NIKLAS") return <NiklasCharacter expression={chatBusy ? "talking" : "neutral"} className="block h-[200px] w-[200px] max-w-none" />;
    if (pid === "NINA") return <NinaCharacter expression={chatBusy ? "talking" : "idle"} className="block h-[200px] w-[200px] max-w-none" />;
    if (pid === "SCHNEIDER") return <SchneiderCharacter expression={chatBusy ? "talking" : "neutral"} className="block h-[200px] w-[200px] max-w-none" />;
    if (pid === "WEBER") return <WeberCharacter expression={chatBusy ? "talking" : "idle"} className="block h-[200px] w-[200px] max-w-none" />;
    if (pid === "THOMAS") return <ThomasCharacter expression={chatBusy ? "talking" : "neutral"} className="block h-[200px] w-[200px] max-w-none" />;
    if (pid === "SARAH") return <SarahCharacter expression={chatBusy ? "talking" : "idle"} className="block h-[200px] w-[200px] max-w-none" />;
    if (pid === "HANNIE") return <HannieCharacter expression={chatBusy ? "talking" : "idle"} className="block h-[200px] w-[200px] max-w-none" />;
    if (pid === "MINH") return <MinhCharacter expression={chatBusy ? "talking" : "neutral"} className="block h-[200px] w-[200px] max-w-none" />;
    return <LukasCharacter expression={exprLukas} className="block h-[200px] w-[200px] max-w-none" />;
  };

  return (
    <div
      className={cn(
        "relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-ga-card",
        className,
      )}
    >
      <div
        className="absolute left-1/2 top-1/2 origin-center"
        style={{ transform: "translate(-50%, -42%) scale(1.6)" }}
      >
        {inner(id)}
      </div>
    </div>
  );
}
