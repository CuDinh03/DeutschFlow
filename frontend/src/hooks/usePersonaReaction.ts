"use client";

import { useEffect, useRef, useState } from "react";
import type { StreamStatus } from "@/types/ai-speaking";
import type { ErrorItem } from "@/lib/aiSpeakingApi";

export type PersonaReaction = "idle" | "listening" | "talking" | "thinking" | "concerned";

interface Opts {
  streamStatus: StreamStatus;
  isListening: boolean;
  isSpeaking: boolean;
  lastUserErrors: ErrorItem[];
}

// "concerned" flashes for this duration then reverts to idle
const CONCERNED_DURATION_MS = 2200;

export function usePersonaReaction({
  streamStatus,
  isListening,
  isSpeaking,
  lastUserErrors,
}: Opts): PersonaReaction {
  const [concerned, setConcerned] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevErrorCount = useRef(lastUserErrors.length);

  useEffect(() => {
    const curr = lastUserErrors.length;
    if (curr > prevErrorCount.current) {
      setConcerned(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setConcerned(false), CONCERNED_DURATION_MS);
    }
    prevErrorCount.current = curr;
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [lastUserErrors.length]);

  if (streamStatus === "streaming" || isSpeaking) return "talking";
  if (streamStatus === "processing") return "thinking";
  if (isListening) return "listening";
  if (concerned) return "concerned";
  return "idle";
}
