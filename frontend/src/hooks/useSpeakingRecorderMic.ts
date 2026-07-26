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

  /**
   * Số thứ tự của lượt thu âm hiện tại (R-W8).
   *
   * Transcribe + chấm phát âm là hai lượt gọi mạng chạy SAU khi người dùng đã thả mic, nên kết quả
   * có thể về muộn — sau khi họ bấm mic lần nữa, hoặc sau khi rời trang. Trước đây không có chốt
   * nào: một transcript cũ về muộn vẫn `onTranscript(...)` đè lên ô nhập (chính là hiện tượng
   * "text cũ quay lại ô nhập" trong ảnh ④ đêm 23/07) và vẫn setState sau khi component unmount.
   *
   * Mỗi lần bắt đầu thu — và mỗi lần {@link cleanup} — đều tăng số này. Callback bất đồng bộ giữ
   * số của lượt sinh ra nó và tự bỏ kết quả nếu số đã đổi.
   */
  const captureSeqRef = useRef(0);

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

      const seq = ++captureSeqRef.current;
      /** Lượt này còn là lượt hiện tại không — false nghĩa là đã có lượt mới hoặc đã cleanup. */
      const isCurrent = () => captureSeqRef.current === seq;

      try {
        const handle = await startRecorder(async (blob) => {
          if (!isCurrent()) return;
          recorderRef.current = null;
          setIsListening(false);
          setIsTranscribing(true);
          try {
            const { data } = await aiSpeakingApi.transcribe(blob);
            const txt = (data.transcript ?? "").trim();
            // Chốt sau MỖI lượt await: transcript về muộn không được đè ô nhập của lượt khác.
            if (txt && isCurrent()) {
              onTranscript(txt);
              setIsEvaluatingPhoneme(true);
              try {
                const evalRes = await evaluatePhoneme(blob, txt);
                if (!isCurrent()) return;
                setPhonemeResult(evalRes);
                onPhonemeScored?.(evalRes.score);
              } catch {
                if (isCurrent()) setMicError(t("phonemeEvalFailed"));
              } finally {
                if (isCurrent()) setIsEvaluatingPhoneme(false);
              }
            }
          } catch (err: unknown) {
            if (!isCurrent()) return;
            const st = httpStatus(err);
            setMicError(st === 429 ? t("errorQuota") : t("transcriptionFailed"));
          } finally {
            if (isCurrent()) setIsTranscribing(false);
          }
        });
        if (!isCurrent()) {
          // Đã cleanup/đổi lượt trong lúc chờ quyền mic: dừng ngay, đừng để recorder chạy mồ côi.
          handle.stop();
          return;
        }
        recorderRef.current = handle;
        setIsListening(true);
      } catch (err: unknown) {
        if (!isCurrent()) return;
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

  /**
   * Gọi khi rời trang. Tăng số thứ tự để mọi kết quả transcribe/phoneme đang bay về bị bỏ — không
   * còn setState sau unmount, và không còn transcript của phiên cũ nhảy vào ô nhập của phiên mới.
   */
  const cleanup = useCallback(() => {
    captureSeqRef.current++;
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
