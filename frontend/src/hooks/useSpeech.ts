"use client";

import { useState, useCallback, useRef } from "react";
import { getAccessToken } from "@/lib/authSession";

interface UseSpeechOptions {
  lang?: string;
}

/**
 * TTS Priority: 
 * 1. Local voice file (/public/voices/{voiceFile}) — instant, no API cost
 * 2. ElevenLabs API (backend /api/ai-speaking/tts) — cloned voice, requires voiceId in .env
 * 3. Browser Web Speech API (speechSynthesis) — universal fallback
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
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    return recognition;
  }, [options.lang]);

  const resetSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      // Auto-stop after SILENCE_TIMEOUT_MS of no speech
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
        // Reset silence timer on every speech result
        resetSilenceTimer();

        // Build the full transcript: accumulated finals + current segment
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

        // Append newly finalized text to the accumulated buffer
        // Guard: skip if this is the same segment Chrome re-emitted after restart
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

        // Send full text to callback: all finalized text + current interim
        const fullText = currentInterim
          ? (accumulatedTextRef.current ? accumulatedTextRef.current + " " + currentInterim : currentInterim)
          : accumulatedTextRef.current;

        if (fullText && onResultCallbackRef.current) {
          onResultCallbackRef.current(fullText, !currentInterim && !!currentFinal);
        }
      };

      recognition.onerror = (event: any) => {
        // "no-speech" and "aborted" are normal — don't treat as fatal
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
        // Browser auto-stopped (e.g. after finalizing a long segment in Chrome)
        // If user didn't intentionally stop, auto-restart
        if (!intentionalStopRef.current && isListeningRef.current && !restartingRef.current) {
          restartingRef.current = true;
          console.info("[STT] Browser auto-stopped, restarting recognition...");
          // Longer delay (500ms) to let Android Chrome fully flush its audio buffer
          // and prevent re-processing the same audio segment on restart
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
                console.error("[STT] Failed to restart recognition:", err);
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
      };
    },
    [initRecognition, resetSilenceTimer, clearSilenceTimer]
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

  // ─── Tier 2: ElevenLabs API (backend proxy) ─────────────────────────────

  const speakElevenLabs = useCallback(
    async (text: string, personaId: string, onEnd?: () => void): Promise<boolean> => {
      try {
        const token = getAccessToken();
        const res = await fetch("/api/ai-speaking/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ text, persona: personaId.toUpperCase() }),
        });

        if (!res.ok || res.status === 503) return false;

        const blob = await res.blob();
        if (!blob || blob.size === 0) return false;

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

  // ─── Tier 1: Local voice file (/public/voices/) ─────────────────────────

  const speakLocalFile = useCallback(
    async (voiceFile: string, onEnd?: () => void): Promise<boolean> => {
      try {
        const url = `/voices/${voiceFile}`;
        const audio = new Audio(url);
        audioRef.current = audio;
        setIsSpeaking(true);

        await new Promise<void>((resolve, reject) => {
          audio.onended = () => {
            audioRef.current = null;
            resolve();
          };
          audio.onerror = () => {
            audioRef.current = null;
            reject(new Error("Local voice file failed"));
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

  // ─── Main: speakWithPersona (3-tier cascade) ─────────────────────────────

  /**
   * Speaks text using the character's cloned voice.
   * Priority: ElevenLabs API (clone) → Browser TTS (fallback)
   *
   * @param text      German text to speak
   * @param personaId persona id (e.g. "lukas", "emma", "anna", "klaus")
   * @param voiceFile local file name for offline fallback (e.g. "lukas.wav")
   * @param onEnd     callback when speech ends
   */
  const speakWithPersona = useCallback(
    async (
      text: string,
      personaId: string,
      voiceFile?: string | null,
      onEnd?: () => void
    ) => {
      if (!text || typeof window === "undefined") return;
      stopAll();

      // Tier 1: ElevenLabs API — cloned voice (real person's voice)
      const ok1 = await speakElevenLabs(text, personaId, onEnd);
      if (ok1) return;
      console.info("[TTS] ElevenLabs failed/unavailable → browser fallback");

      // Tier 2: Browser Web Speech API — universal fallback
      speakBrowser(text, onEnd);
    },
    [stopAll, speakElevenLabs, speakBrowser]
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
