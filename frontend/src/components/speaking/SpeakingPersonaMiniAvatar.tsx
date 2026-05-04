"use client";

import { cn } from "@/lib/utils";
import { LukasCharacter } from "./characters/LukasCharacter";
import { EmmaCharacter } from "./characters/EmmaCharacter";
import { HannaCharacter } from "./characters/HannaCharacter";
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

  const inner = (pid: SpeakingPersonaVisualId) => {
    if (pid === "EMMA") {
      return <EmmaCharacter expression={exprEmma} className="block h-[200px] w-[200px] max-w-none" />;
    }
    if (pid === "HANNA") {
      return <HannaCharacter expression={exprHanna} className="block h-[200px] w-[200px] max-w-none" />;
    }
    return <LukasCharacter expression={exprLukas} className="block h-[200px] w-[200px] max-w-none" />;
  };

  return (
    <div
      className={cn(
        "relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-white/[0.06]",
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
