// ─────────────────────────────────────────────────────────────────────────────
// DeutschFlow · useTypewriter hook
// Simulates a streaming/typewriter effect for AI message display.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";

interface UseTypewriterResult {
  displayed: string;
  done: boolean;
  progress: number; // 0–1 for progress indicators
}

/**
 * @param text    The full target string to animate
 * @param active  When true, starts/restarts the animation; when false, resets
 * @param speed   Milliseconds per character (default 26 ms → ~38 chars/sec)
 */
export function useTypewriter(
  text: string,
  active: boolean,
  speed = 26,
): UseTypewriterResult {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) {
      setDisplayed("");
      setDone(false);
      return;
    }

    setDisplayed("");
    setDone(false);
    let i = 0;

    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        setDone(true);
      }
    }, speed);

    return () => clearInterval(id);
  }, [text, active, speed]);

  const progress = text.length > 0 ? displayed.length / text.length : 0;

  return { displayed, done, progress };
}
