"use client";

import { useCallback, useRef, useState } from "react";
import { aiSpeakingApi } from "@/lib/aiSpeakingApi";
import { evaluatePhoneme, type PhonemeEvalResult } from "@/lib/phonemeApi";
import { startRecorder, type RecorderHandle } from "@/lib/voiceRecorder";
import { apiMessage, httpStatus } from "@/lib/api";

type TFn = (key: string) => string;

export function useSpeakingRecorderMic(
  t: TFn,
  onPhonemeScored?: (score: number) => void,
) {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isEvaluatingPhoneme, setIsEvaluatingPhoneme] = useState(false);
  const [phonemeResult, setPhonemeResult] = useState<PhonemeEvalResult | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  const recorderRef = useRef<RecorderHandle | null>(null);

  const clearPhoneme = useCallback(() => setPhonemeResult(null), []);

  const stopRecorder = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setIsListening(false);
  }, []);

  const startMic = useCallback(
    async (onTranscript: (text: string) => void) => {
      if (isListening || isTranscribing || isEvaluatingPhoneme) return;
      setMicError(null);

      try {
        const handle = await startRecorder(async (blob) => {
          recorderRef.current = null;
          setIsListening(false);
          setIsTranscribing(true);
          try {
            const { data } = await aiSpeakingApi.transcribe(blob);
            const txt = (data.transcript ?? "").trim();
            if (txt) {
              onTranscript(txt);
              setIsEvaluatingPhoneme(true);
              try {
                const evalRes = await evaluatePhoneme(blob, txt);
                setPhonemeResult(evalRes);
                onPhonemeScored?.(evalRes.score);
              } catch {
                setMicError(t("phonemeEvalFailed"));
              } finally {
                setIsEvaluatingPhoneme(false);
              }
            }
          } catch (err: unknown) {
            const st = httpStatus(err);
            setMicError(st === 429 ? t("errorQuota") : t("transcriptionFailed"));
          } finally {
            setIsTranscribing(false);
          }
        });
        recorderRef.current = handle;
        setIsListening(true);
      } catch {
        setMicError(t("microphoneDenied"));
      }
    },
    [isListening, isTranscribing, isEvaluatingPhoneme, t, onPhonemeScored],
  );

  const toggleMic = useCallback(
    (onTranscript: (text: string) => void) => {
      if (isListening) {
        stopRecorder();
      } else {
        void startMic(onTranscript);
      }
    },
    [isListening, startMic, stopRecorder],
  );

  const cleanup = useCallback(() => {
    stopRecorder();
    setIsTranscribing(false);
    setIsEvaluatingPhoneme(false);
  }, [stopRecorder]);

  return {
    isListening,
    isTranscribing,
    isEvaluatingPhoneme,
    phonemeResult,
    micError,
    setMicError,
    clearPhoneme,
    toggleMic,
    stopRecorder,
    cleanup,
  };
}
