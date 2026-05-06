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

  // ─── Speech Recognition (STT) ────────────────────────────────────────────

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
    return recognition;
  }, [options.lang]);

  const startListening = useCallback(
    (onResult: (text: string, isFinal: boolean) => void, onError?: (err: any) => void) => {
      if (isListening) return;
      const recognition = initRecognition();
      if (!recognition) return;
      recognitionRef.current = recognition;
      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) final += event.results[i][0].transcript;
          else interim += event.results[i][0].transcript;
        }
        if (final) onResult(final, true);
        else if (interim) onResult(interim, false);
      };
      recognition.onerror = (event: any) => {
        if (onError) onError(event.error);
        setIsListening(false);
      };
      recognition.onend = () => setIsListening(false);
      try { recognition.start(); } catch (err) { console.error(err); }
    },
    [initRecognition, isListening]
  );

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

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
