"use client";

import { useState, useCallback, useRef } from "react";
import api from "@/lib/api";

interface UseSpeechOptions {
  lang?: string;
}

/**
 * TTS Priority:
 * 1. Server TTS (backend /api/ai-speaking/tts) — self-hosted persona voices, returns MP3 bytes
 * 2. Browser Web Speech API (speechSynthesis) — universal fallback
 */
export function useSpeech(options: UseSpeechOptions = { lang: "de-DE" }) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ─── STT: Accumulated transcript & control refs ───────────────────────
  const accumulatedTextRef = useRef<string>("");
  const intentionalStopRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onResultCallbackRef = useRef<((text: string, isFinal: boolean) => void) | null>(null);
  const onErrorCallbackRef = useRef<((err: any) => void) | null>(null);
  const isListeningRef = useRef<boolean>(false);
  /** Tracks the last finalized segment to prevent Android Chrome from re-emitting it on restart. */
  const lastFinalizedSegmentRef = useRef<string>("");
  /** Guards against re-entrant restart loops. */
  const restartingRef = useRef<boolean>(false);

  /** How long (ms) to wait with zero speech before auto-stopping mic. */
  const SILENCE_TIMEOUT_MS = 120_000; // 2 minutes

  // ─── Speech Recognition (STT) ────────────────────────────────────────────

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  /** Detect mobile browsers (Android, iOS) where continuous mode is unreliable. */
  const isMobile = typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const initRecognition = useCallback(() => {
    if (typeof window === "undefined") return null;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Browser does not support SpeechRecognition API.");
      return null;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = options.lang;
    // Mobile: single-shot mode (no continuous, no interim) — prevents duplication
    // Desktop: continuous mode with interim for live preview
    recognition.continuous = !isMobile;
    recognition.interimResults = !isMobile;
    recognition.maxAlternatives = 1;
    return recognition;
  }, [options.lang, isMobile]);

  const resetSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      if (isListeningRef.current && recognitionRef.current) {
        console.info("[STT] Silence timeout reached, auto-stopping mic.");
        intentionalStopRef.current = true;
        recognitionRef.current.stop();
        isListeningRef.current = false;
        setIsListening(false);
      }
    }, SILENCE_TIMEOUT_MS);
  }, [clearSilenceTimer]);

  const attachRecognitionHandlers = useCallback(
    (recognition: any) => {
      recognition.onstart = () => {
        isListeningRef.current = true;
        restartingRef.current = false;
        setIsListening(true);
        resetSilenceTimer();
      };

      recognition.onresult = (event: any) => {
        resetSilenceTimer();

        if (isMobile) {
          // ── MOBILE: Simple single-shot — just grab the final result ──
          // No interim, no accumulation complexity
          let finalText = "";
          for (let i = 0; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalText += event.results[i][0].transcript;
            }
          }
          if (finalText.trim()) {
            // Append to accumulated text (for multi-shot: user presses mic multiple times)
            if (accumulatedTextRef.current) {
              accumulatedTextRef.current += " " + finalText.trim();
            } else {
              accumulatedTextRef.current = finalText.trim();
            }
            if (onResultCallbackRef.current) {
              onResultCallbackRef.current(accumulatedTextRef.current, true);
            }
          }
        } else {
          // ── DESKTOP: Continuous mode with interim preview ──
          let currentFinal = "";
          let currentInterim = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              currentFinal += transcript;
            } else {
              currentInterim += transcript;
            }
          }

          if (currentFinal) {
            const trimmed = currentFinal.trim();
            if (trimmed && trimmed !== lastFinalizedSegmentRef.current) {
              if (accumulatedTextRef.current && !accumulatedTextRef.current.endsWith(" ")) {
                accumulatedTextRef.current += " ";
              }
              accumulatedTextRef.current += trimmed;
              lastFinalizedSegmentRef.current = trimmed;
            }
          }

          const fullText = currentInterim
            ? (accumulatedTextRef.current ? accumulatedTextRef.current + " " + currentInterim : currentInterim)
            : accumulatedTextRef.current;

          if (fullText && onResultCallbackRef.current) {
            onResultCallbackRef.current(fullText, !currentInterim && !!currentFinal);
          }
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === "no-speech" || event.error === "aborted") {
          return;
        }
        if (onErrorCallbackRef.current) onErrorCallbackRef.current(event.error);
        clearSilenceTimer();
        isListeningRef.current = false;
        restartingRef.current = false;
        setIsListening(false);
      };

      recognition.onend = () => {
        if (isMobile) {
          // ── MOBILE: Single-shot ended — keep mic "on" by auto-restarting ──
          // But NO audio buffer carryover since each shot is independent
          if (!intentionalStopRef.current && isListeningRef.current && !restartingRef.current) {
            restartingRef.current = true;
            setTimeout(() => {
              if (!intentionalStopRef.current && isListeningRef.current) {
                try {
                  const newRecognition = initRecognition();
                  if (newRecognition) {
                    recognitionRef.current = newRecognition;
                    attachRecognitionHandlers(newRecognition);
                    newRecognition.start();
                  } else {
                    restartingRef.current = false;
                  }
                } catch (err) {
                  console.error("[STT] Mobile restart failed:", err);
                  clearSilenceTimer();
                  isListeningRef.current = false;
                  restartingRef.current = false;
                  setIsListening(false);
                }
              } else {
                restartingRef.current = false;
              }
            }, 300);
          } else if (!restartingRef.current) {
            clearSilenceTimer();
            isListeningRef.current = false;
            setIsListening(false);
          }
        } else {
          // ── DESKTOP: Continuous mode auto-restart ──
          if (!intentionalStopRef.current && isListeningRef.current && !restartingRef.current) {
            restartingRef.current = true;
            setTimeout(() => {
              if (!intentionalStopRef.current && isListeningRef.current) {
                try {
                  const newRecognition = initRecognition();
                  if (newRecognition) {
                    recognitionRef.current = newRecognition;
                    attachRecognitionHandlers(newRecognition);
                    newRecognition.start();
                  } else {
                    restartingRef.current = false;
                  }
                } catch (err) {
                  console.error("[STT] Desktop restart failed:", err);
                  clearSilenceTimer();
                  isListeningRef.current = false;
                  restartingRef.current = false;
                  setIsListening(false);
                }
              } else {
                restartingRef.current = false;
              }
            }, 500);
          } else if (!restartingRef.current) {
            clearSilenceTimer();
            isListeningRef.current = false;
            setIsListening(false);
          }
        }
      };
    },
    [initRecognition, resetSilenceTimer, clearSilenceTimer, isMobile]
  );

  const startListening = useCallback(
    (onResult: (text: string, isFinal: boolean) => void, onError?: (err: any) => void) => {
      if (isListeningRef.current) return;

      const recognition = initRecognition();
      if (!recognition) return;

      // Reset state for new session
      accumulatedTextRef.current = "";
      lastFinalizedSegmentRef.current = "";
      intentionalStopRef.current = false;
      restartingRef.current = false;
      onResultCallbackRef.current = onResult;
      onErrorCallbackRef.current = onError ?? null;
      recognitionRef.current = recognition;

      attachRecognitionHandlers(recognition);

      try {
        recognition.start();
      } catch (err) {
        console.error("[STT] Failed to start recognition:", err);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initRecognition, resetSilenceTimer, clearSilenceTimer]
  );

  const stopListening = useCallback(() => {
    intentionalStopRef.current = true;
    clearSilenceTimer();
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    isListeningRef.current = false;
    setIsListening(false);
  }, [clearSilenceTimer]);

  // ─── Internal: stop all audio ───────────────────────────────────────────

  const stopAll = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  // ─── Tier 3: Browser Web Speech API (fallback) ──────────────────────────

  const speakBrowser = useCallback(
    (text: string, onEnd?: () => void) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        setIsSpeaking(false);
        if (onEnd) onEnd();
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = options.lang || "de-DE";
      utterance.rate = 0.9;
      const voices = window.speechSynthesis.getVoices();
      const germanVoice = voices.find(
        (v) => v.lang.startsWith("de") && v.name.includes("Google")
      );
      if (germanVoice) utterance.voice = germanVoice;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        if (onEnd) onEnd();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        if (onEnd) onEnd();
      };
      window.speechSynthesis.speak(utterance);
    },
    [options.lang]
  );

  // ─── Tier 1: Server TTS (self-hosted persona voices via backend proxy) ──

  // Replaying the same sentence (very common when practicing pronunciation) must not
  // re-hit the network: POST responses bypass the browser HTTP cache, so memo here.
  const audioCacheRef = useRef<Map<string, Blob>>(new Map());
  const AUDIO_CACHE_MAX_ENTRIES = 20;

  const speakServerTts = useCallback(
    async (text: string, personaId: string, onEnd?: () => void): Promise<boolean> => {
      try {
        const cacheKey = `${personaId.toUpperCase()}|${text}`;
        let blob = audioCacheRef.current.get(cacheKey) ?? null;

        if (!blob) {
          // Backend (/api/ai-speaking/tts) returns raw audio/mpeg bytes, not JSON.
          // Read the body as a Blob and play it via an object URL.
          const res = await api.post(
            "/ai-speaking/tts",
            { text, persona: personaId.toUpperCase() },
            { responseType: "blob" }
          );
          blob = res.data as Blob;
        }
        if (!blob || blob.size === 0) return false;

        audioCacheRef.current.delete(cacheKey);
        audioCacheRef.current.set(cacheKey, blob);
        if (audioCacheRef.current.size > AUDIO_CACHE_MAX_ENTRIES) {
          const oldest = audioCacheRef.current.keys().next().value;
          if (oldest !== undefined) audioCacheRef.current.delete(oldest);
        }

        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        setIsSpeaking(true);

        await new Promise<void>((resolve, reject) => {
          audio.onended = () => {
            URL.revokeObjectURL(url);
            audioRef.current = null;
            resolve();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(url);
            audioRef.current = null;
            reject(new Error("Audio playback failed"));
          };
          audio.play().catch(reject);
        });

        setIsSpeaking(false);
        if (onEnd) onEnd();
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  // ─── Main: speakWithPersona (2-tier cascade) ─────────────────────────────

  /**
   * Speaks text using the character's cloned voice.
   * Priority:
   *   Tier 1 — Server TTS (backend /api/ai-speaking/tts) — persona voice
   *   Tier 2 — Browser Web Speech API — universal fallback
   *
   * @param text      German text to speak
   * @param personaId persona id (e.g. "lukas", "emma", "anna", "klaus")
   * @param onEnd     callback when speech ends
   *
   * NOTE: Callers should return stopSpeaking + stopListening in their
   * useEffect cleanup to prevent Audio/SpeechRecognition memory leaks:
   *   useEffect(() => () => { stopSpeaking(); stopListening(); }, []);
   */
  const speakWithPersona = useCallback(
    async (text: string, personaId: string, onEnd?: () => void) => {
      if (!text || typeof window === "undefined") return;
      stopAll();

      // Tier 1: Server TTS — persona voice
      const ok = await speakServerTts(text, personaId, onEnd);
      if (ok) return;
      console.info("[TTS] Server TTS failed/unavailable → browser fallback");

      // Tier 2: Browser Web Speech API — universal fallback
      speakBrowser(text, onEnd);
    },
    [stopAll, speakServerTts, speakBrowser]
  );

  // ─── Legacy: speak (uses browser TTS) ──────────────────────────────────

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      stopAll();
      speakBrowser(text, onEnd);
    },
    [stopAll, speakBrowser]
  );

  const stopSpeaking = stopAll;

  return {
    isListening,
    isSpeaking,
    startListening,
    stopListening,
    speak,
    speakWithPersona,
    speakBrowser,
    stopSpeaking,
  };
}
