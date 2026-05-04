"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import type { SessionState } from "@/components/speaking/types";
import type { AiMessageBubble } from "@/components/speaking/types";
import {
  aiSpeakingApi,
  chatStream,
  type AiChatResponse,
  type AiSpeakingSession,
  AI_SPEAKING_UNAUTHORIZED,
} from "@/lib/aiSpeakingApi";
import { apiMessage, httpStatus } from "@/lib/api";
import { toastApiError } from "@/lib/toastApiError";
import { speakGerman } from "@/lib/speechDe";
import { startRecorder, type RecorderHandle } from "@/lib/voiceRecorder";

export type RepairGateState = {
  code: string;
  exampleCorrectDe?: string;
  ruleViShort?: string;
  blocking?: boolean;
} | null;

export function mapResponseToBubble(meta: AiChatResponse, isStreaming?: boolean): AiMessageBubble {
  return {
    id: meta.messageId,
    role: "ASSISTANT",
    aiSpeechDe: meta.aiSpeechDe,
    correction: meta.correction,
    explanationVi: meta.explanationVi,
    grammarPoint: meta.grammarPoint,
    newWord: meta.learningStatus?.newWord,
    userInterestDetected: meta.learningStatus?.userInterestDetected,
    errors: meta.errors,
    status: meta.status,
    feedback: meta.feedback,
    suggestions: meta.suggestions,
    action: meta.action ?? undefined,
    adaptive: meta.adaptive
      ? {
          enabled: meta.adaptive.enabled,
          cefrEffective: meta.adaptive.cefrEffective,
          difficultyKnob: meta.adaptive.difficultyKnob,
          focusCodes: meta.adaptive.focusCodes ?? [],
          targetStructures: meta.adaptive.targetStructures ?? [],
          topicSuggestion: meta.adaptive.topicSuggestion,
          forceRepairBeforeContinue: meta.adaptive.forceRepairBeforeContinue,
          primaryRepairErrorCode: meta.adaptive.primaryRepairErrorCode,
        }
      : undefined,
    isStreaming,
  };
}

function formatSendError(err: unknown, t: (k: string) => string): string {
  if (httpStatus(err) === 429) return t("errorQuota");
  const m = apiMessage(err);
  if (m && m.length > 0) return m;
  return t("errorSend");
}

type TFn = (key: string) => string;

export function useSpeakingChat(opts: {
  session: AiSpeakingSession | null;
  sessionState: SessionState;
  setSessionState: React.Dispatch<React.SetStateAction<SessionState>>;
  inputText: string;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
  t: TFn;
  /** When user stops recording and audio processing begins (clears visualizer). */
  onRecordingStopped?: () => void;
}) {
  const { session, sessionState, setSessionState, inputText, setInputText, t, onRecordingStopped } = opts;
  const locale = useLocale();

  const [realMessages, setRealMessages] = useState<AiMessageBubble[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [chatNotice, setChatNotice] = useState<string | null>(null);
  const [endingSession, setEndingSession] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [repairGate, setRepairGate] = useState<RepairGateState>(null);
  const [pendingAdaptiveRepairMsgId, setPendingAdaptiveRepairMsgId] = useState<number | null>(null);

  const streamCtrl = useRef<AbortController | null>(null);
  const recorderRef = useRef<RecorderHandle | null>(null);
  const tempIdRef = useRef(0);
  const streamingAssistantIdRef = useRef<number | null>(null);
  const lastSendRef = useRef<{ userId: number; text: string; textOverride?: string } | null>(null);

  const nextTempId = useCallback(() => {
    tempIdRef.current -= 1;
    return tempIdRef.current;
  }, []);

  const resetForNewSession = useCallback(() => {
    streamCtrl.current?.abort();
    streamCtrl.current = null;
    tempIdRef.current = 0;
    streamingAssistantIdRef.current = null;
    lastSendRef.current = null;
    setRealMessages([]);
    setError(null);
    setChatNotice(null);
    setPendingAdaptiveRepairMsgId(null);
    setRepairGate(null);
  }, []);

  const openAdaptiveRepairIfNeeded = useCallback((meta: AiChatResponse) => {
    const a = meta.adaptive;
    if (a?.forceRepairBeforeContinue && a.primaryRepairErrorCode) {
      const err = meta.errors?.find((e) => e.errorCode === a.primaryRepairErrorCode);
      setRepairGate({
        code: a.primaryRepairErrorCode,
        exampleCorrectDe: err?.exampleCorrectDe ?? undefined,
        ruleViShort: err?.ruleViShort ?? undefined,
        blocking: true,
      });
      setPendingAdaptiveRepairMsgId(meta.messageId);
    } else {
      setPendingAdaptiveRepairMsgId(null);
    }
  }, []);

  const seedInitialAssistant = useCallback(
    (initial: AiChatResponse | null | undefined) => {
      if (!initial) return;
      openAdaptiveRepairIfNeeded(initial);
    },
    [openAdaptiveRepairIfNeeded],
  );

  useEffect(() => {
    return () => {
      streamCtrl.current?.abort();
      streamCtrl.current = null;
    };
  }, []);

  const rollbackLastSend = useCallback(() => {
    const last = lastSendRef.current;
    if (!last) return;
    const assistantTemp = streamingAssistantIdRef.current;
    setRealMessages((prev) =>
      prev.filter((m) => m.id !== last.userId && (assistantTemp == null || m.id !== assistantTemp)),
    );
    if (!last.textOverride) setInputText(last.text);
    streamingAssistantIdRef.current = null;
    lastSendRef.current = null;
  }, [setInputText]);

  const handleSendMessage = useCallback(
    async (textOverride?: string) => {
      const text = textOverride || inputText.trim();
      if (!text || sessionState !== "chatting" || !session) return;

      if (pendingAdaptiveRepairMsgId !== null) {
        setError(t("forceRepairBanner"));
        return;
      }

      setError(null);
      setChatNotice(null);

      if (!textOverride) setInputText("");

      const userId = nextTempId();
      const assistantTempId = nextTempId();
      streamingAssistantIdRef.current = assistantTempId;
      lastSendRef.current = { userId, text, textOverride };

      const userMsg: AiMessageBubble = { id: userId, userText: text, role: "USER" };
      const placeholder: AiMessageBubble = {
        id: assistantTempId,
        role: "ASSISTANT",
        aiSpeechDe: "",
        isStreaming: true,
      };
      setRealMessages((prev) => [...prev, userMsg, placeholder]);

      setIsSending(true);

      const finishFailure = (msg: string, err?: unknown) => {
        rollbackLastSend();
        setError(msg);
        setIsSending(false);
        if (err !== undefined) {
          const st = httpStatus(err);
          if (st === 429 || st >= 500 || st === 0) toastApiError(err, { locale });
        }
      };

      streamCtrl.current?.abort();
      streamCtrl.current = chatStream(
        session.id,
        text,
        (delta) => {
          const aid = streamingAssistantIdRef.current;
          if (aid == null) return;
          setRealMessages((prev) =>
            prev.map((m) =>
              m.id === aid ? { ...m, aiSpeechDe: (m.aiSpeechDe ?? "") + delta } : m,
            ),
          );
        },
        (meta) => {
          const aid = streamingAssistantIdRef.current;
          streamingAssistantIdRef.current = null;
          lastSendRef.current = null;
          setRealMessages((prev) =>
            prev.map((m) => (m.id === aid ? mapResponseToBubble(meta, false) : m)),
          );
          if (meta.aiSpeechDe) speakGerman(meta.aiSpeechDe);
          openAdaptiveRepairIfNeeded(meta);
          setIsSending(false);
          streamCtrl.current = null;
        },
        (errStr) => {
          void (async () => {
            if (errStr === AI_SPEAKING_UNAUTHORIZED) {
              finishFailure(t("errorSend"), undefined);
              streamCtrl.current = null;
              return;
            }

            try {
              const res = await aiSpeakingApi.chat(session.id, text);
              const aid = streamingAssistantIdRef.current;
              streamingAssistantIdRef.current = null;
              lastSendRef.current = null;
              setRealMessages((prev) => {
                const withoutPlace = aid != null ? prev.filter((m) => m.id !== aid) : prev;
                return [...withoutPlace, mapResponseToBubble(res.data, false)];
              });
              if (res.data.aiSpeechDe) speakGerman(res.data.aiSpeechDe);
              openAdaptiveRepairIfNeeded(res.data);
              setChatNotice(t("streamFallback"));
              setError(null);
              setIsSending(false);
              streamCtrl.current = null;
            } catch (fe: unknown) {
              finishFailure(formatSendError(fe, t), fe);
              streamCtrl.current = null;
            }
          })();
        },
      );
    },
    [
      inputText,
      session,
      sessionState,
      nextTempId,
      rollbackLastSend,
      openAdaptiveRepairIfNeeded,
      t,
      setInputText,
      pendingAdaptiveRepairMsgId,
      locale,
    ],
  );

  const handleEndSession = useCallback(async () => {
    if (!session || endingSession || sessionState !== "chatting") return;
    streamCtrl.current?.abort();
    setEndingSession(true);
    setError(null);
    try {
      await aiSpeakingApi.endSession(session.id);
      setSessionState("summary");
    } catch (err: unknown) {
      setError(apiMessage(err));
      {
        const st = httpStatus(err);
        if (st === 429 || st >= 500 || st === 0) toastApiError(err, { locale });
      }
    } finally {
      setEndingSession(false);
    }
  }, [session, endingSession, sessionState, setSessionState, locale]);

  const handleStartRecord = useCallback(async () => {
    try {
      const r = await startRecorder(async (audioBlob) => {
        recorderRef.current = null;
        onRecordingStopped?.();
        setIsTranscribing(true);
        try {
          const { data } = await aiSpeakingApi.transcribe(audioBlob);
          const txt = (data.transcript ?? "").trim();
          if (txt) setInputText((prev) => (prev ? `${prev.trim()}\n${txt}` : txt));
        } catch (err: unknown) {
          const st = httpStatus(err);
          setError(st === 429 ? t("errorQuota") : t("transcriptionFailed"));
          if (st === 429 || st >= 500 || st === 0) toastApiError(err, { locale });
        } finally {
          setIsTranscribing(false);
        }
      });
      recorderRef.current = r;
      return r;
    } catch {
      setError(t("microphoneDenied"));
      return null;
    }
  }, [setInputText, t, onRecordingStopped, locale]);

  const handleStopRecord = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const closeRepairGate = useCallback(() => {
    setRepairGate((g) => {
      if (g?.blocking) setPendingAdaptiveRepairMsgId(null);
      return null;
    });
  }, []);

  const openRepairFromChip = useCallback(
    (code: string, exampleCorrectDe: string, ruleViShort: string) => {
      setRepairGate({ code, exampleCorrectDe, ruleViShort, blocking: false });
    },
    [],
  );

  return {
    realMessages,
    setRealMessages,
    error,
    setError,
    chatNotice,
    setChatNotice,
    endingSession,
    isSending,
    isTranscribing,
    repairGate,
    handleSendMessage,
    handleEndSession,
    handleStartRecord,
    handleStopRecord,
    recorderRef,
    streamCtrl,
    seedInitialAssistant,
    closeRepairGate,
    openRepairFromChip,
    pendingAdaptiveRepairMsgId,
    resetForNewSession,
  };
}
