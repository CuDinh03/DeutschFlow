"use client";

import { useCallback, useRef, useState } from "react";
import { aiSpeakingApi } from "@/lib/aiSpeakingApi";
import { evaluatePhoneme, type PhonemeEvalResult } from "@/lib/phonemeApi";
import { startRecorder, type RecorderHandle } from "@/lib/voiceRecorder";
import { httpStatus } from "@/lib/api";
import { classifyMicError, type MicErrorKind } from "@/lib/micErrors";

type TFn = (key: string) => string;

export function useSpeakingRecorderMic(
  t: TFn,
  onPhonemeScored?: (score: number) => void,
) {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isEvaluatingPhoneme, setIsEvaluatingPhoneme] = useState(false);
  const [phonemeResult, setPhonemeResult] = useState<PhonemeEvalResult | null>(null);
  const [micError, setMicErrorRaw] = useState<string | null>(null);
  // Set only for capture failures (permission/device). Generic errors
  // (quota, repair) leave this null so the UI shows the plain status line.
  const [micErrorKind, setMicErrorKind] = useState<MicErrorKind | null>(null);

  // Public setter: clearing or showing a generic message resets the kind.
  const setMicError = useCallback((msg: string | null) => {
    setMicErrorRaw(msg);
    setMicErrorKind(null);
  }, []);

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
      } catch (err: unknown) {
        const info = classifyMicError(err);
        setMicErrorRaw(t(info.messageKey));
        setMicErrorKind(info.kind);
      }
    },
    [isListening, isTranscribing, isEvaluatingPhoneme, t, onPhonemeScored, setMicError],
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
    micErrorKind,
    setMicError,
    clearPhoneme,
    toggleMic,
    stopRecorder,
    cleanup,
  };
}
