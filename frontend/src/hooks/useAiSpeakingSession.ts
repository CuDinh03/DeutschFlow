"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChatStore } from "@/stores/useChatStore";
import {
  aiSpeakingApi,
  chatStream,
  AI_SPEAKING_STREAM_STALLED,
  type AiChatResponse,
  type AiSpeakingQuota,
  type Suggestion,
} from "@/lib/aiSpeakingApi";
import { isAiSpeakingQuotaBlocked } from "@/lib/aiSpeakingQuota";
import { getAutoTtsEnabled, setAutoTtsEnabled } from "@/lib/speakingPreferences";
import { PcmAudioQueue } from "@/lib/pcmAudioQueue";

type TFn = (key: string) => string;

type TrackFn = (feature: string, action: string, props?: Record<string, unknown>) => void;

export function useAiSpeakingSession(opts: {
  sessionMode: string | null;
  openAdaptiveRepairIfNeeded: (meta: AiChatResponse) => void;
  onSpeakAi: (text: string) => void;
  trackFeatureAction: TrackFn;
  onInterviewEnded?: () => void;
}) {
  const {
    sessionMode,
    openAdaptiveRepairIfNeeded,
    onSpeakAi,
    trackFeatureAction,
    onInterviewEnded,
  } = opts;

  const {
    messages,
    addMessage,
    updateLastMessage,
    updateLastUserMessage,
    streamStatus,
    setStreamStatus,
    setMessages,
  } = useChatStore();

  const [lastSuggestions, setLastSuggestions] = useState<Suggestion[]>([]);
  const [quota, setQuota] = useState<AiSpeakingQuota | null>(null);
  const [autoTtsEnabled, setAutoTtsState] = useState(true);
  const [retryUserText, setRetryUserText] = useState<string | null>(null);

  const streamAbortRef = useRef<AbortController | null>(null);
  const audioQueueRef = useRef<PcmAudioQueue | null>(null);

  const getAudioQueue = useCallback(() => {
    if (!audioQueueRef.current) audioQueueRef.current = new PcmAudioQueue();
    return audioQueueRef.current;
  }, []);

  useEffect(() => {
    setAutoTtsState(getAutoTtsEnabled());
  }, []);

  // Release the streaming-TTS AudioContext when the page unmounts / navigates away.
  useEffect(() => {
    return () => {
      audioQueueRef.current?.dispose();
      audioQueueRef.current = null;
    };
  }, []);

  const refreshQuota = useCallback(() => {
    return aiSpeakingApi
      .getQuota()
      .then((res) => {
        setQuota(res.data);
        return res.data;
      })
      .catch(() => {
        setQuota(null);
        return null;
      });
  }, []);

  useEffect(() => {
    void refreshQuota();
  }, [refreshQuota]);

  const quotaBlocked = isAiSpeakingQuotaBlocked(quota);

  const setAutoTts = useCallback((enabled: boolean) => {
    setAutoTtsEnabled(enabled);
    setAutoTtsState(enabled);
  }, []);

  const maybeSpeakAi = useCallback(
    (text: string | null | undefined) => {
      if (!text || !autoTtsEnabled) return;
      onSpeakAi(text);
    },
    [autoTtsEnabled, onSpeakAi],
  );

  const removeStreamingPlaceholder = useCallback(() => {
    const msgs = useChatStore.getState().messages;
    if (msgs.length === 0) return;
    const last = msgs[msgs.length - 1];
    if (last.role === "ai" && last.isStreaming) {
      setMessages(msgs.slice(0, -1));
    }
  }, [setMessages]);

  const sendUserText = useCallback(
    (userText: string, options?: { skipUserBubble?: boolean }) => {
      const sid = useChatStore.getState().sessionId;
      if (!sid || !userText.trim()) return;
      if (isAiSpeakingQuotaBlocked(quota)) {
        setStreamStatus("idle");
        return;
      }

      const trimmed = userText.trim();
      setRetryUserText(null);
      setStreamStatus("processing");

      if (!options?.skipUserBubble) {
        addMessage({
          id: crypto.randomUUID(),
          role: "user",
          contentDe: trimmed,
        });
      }

      addMessage({
        id: crypto.randomUUID(),
        role: "ai",
        contentDe: "",
        isStreaming: true,
      });

      let currentDe = "";
      let audioStreamed = false;
      streamAbortRef.current?.abort();
      audioQueueRef.current?.stop(); // barge-in: stop the previous turn's audio on a new reply
      const audioQueue = autoTtsEnabled ? getAudioQueue() : null;
      audioQueue?.resume(); // sendUserText runs inside a user gesture → safe to resume AudioContext
      const requestStartTime = Date.now();

      streamAbortRef.current = chatStream(
        sid,
        trimmed,
        (delta) => {
          if (useChatStore.getState().streamStatus !== "streaming") {
            setStreamStatus("streaming");
            trackFeatureAction("ai_speaking", "latency", {
              mode: sessionMode,
              latencyMs: Date.now() - requestStartTime,
              type: "first_token",
            });
          }
          currentDe += delta;
          updateLastMessage({ contentDe: currentDe });
        },
        (meta) => {
          setStreamStatus("idle");
          trackFeatureAction("ai_speaking", "latency", {
            mode: sessionMode,
            latencyMs: Date.now() - requestStartTime,
            type: "full_response",
          });

          if (meta.suggestions?.length) {
            setLastSuggestions(meta.suggestions);
          }

          if (meta.interviewPhaseKey || meta.interviewHintKey) {
            useChatStore.getState().setInterviewUiHints(
              meta.interviewPhaseKey ?? null,
              meta.interviewHintKey ?? null,
            );
          }

          const errors = meta.errors || [];
          updateLastUserMessage({ errors });
          updateLastMessage({
            contentDe: meta.aiSpeechDe,
            isStreaming: false,
            feedback: {
              errors,
              explanationVi: meta.explanationVi || "",
              suggestions: meta.suggestions || [],
              correction: meta.correction || null,
              grammarPoint: meta.grammarPoint || null,
              action: meta.action || null,
              status: meta.status ?? null,
              feedbackText: meta.feedback ?? null,
            },
          });

          openAdaptiveRepairIfNeeded(meta);
          if (meta.errors?.length) {
            trackFeatureAction("ai_speaking", "errors_received", {
              count: meta.errors.length,
              mode: sessionMode,
            });
          }
          // XTTS streaming already voiced the reply per-sentence; fall back to on-device TTS only
          // when no audio was streamed (XTTS off / not configured / persona without a voice).
          if (!audioStreamed) maybeSpeakAi(meta.aiSpeechDe);
          void refreshQuota();
          if (meta.isSessionEnded && onInterviewEnded) {
            // Delay slightly so the farewell message renders before the popup
            setTimeout(onInterviewEnded, 1800);
          }
        },
        (err) => {
          if (err.includes("429")) {
            void refreshQuota();
          }
          if (err === AI_SPEAKING_STREAM_STALLED) {
            removeStreamingPlaceholder();
            setStreamStatus("stalled");
            setRetryUserText(trimmed);
            trackFeatureAction("ai_speaking", "stream_stalled", { mode: sessionMode });
            return;
          }
          setStreamStatus("error");
          updateLastMessage({
            contentDe: currentDe || "",
            isStreaming: false,
          });
          console.error("Chat stream error:", err);
        },
        (frame) => {
          audioStreamed = true;
          audioQueue?.enqueue(frame);
        },
        autoTtsEnabled,
      );
    },
    [
      addMessage,
      updateLastMessage,
      updateLastUserMessage,
      setStreamStatus,
      openAdaptiveRepairIfNeeded,
      maybeSpeakAi,
      removeStreamingPlaceholder,
      sessionMode,
      trackFeatureAction,
      quota,
      refreshQuota,
      autoTtsEnabled,
      getAudioQueue,
    ],
  );

  const retryLastSend = useCallback(() => {
    if (!retryUserText || isAiSpeakingQuotaBlocked(quota)) return;
    trackFeatureAction("ai_speaking", "stream_retry", { mode: sessionMode });
    sendUserText(retryUserText, { skipUserBubble: true });
  }, [retryUserText, sendUserText, sessionMode, trackFeatureAction, quota]);

  const abortStream = useCallback(() => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    audioQueueRef.current?.stop(); // stop the persona mid-sentence (session end / leave / Escape)
  }, []);

  const trackSuggestionUsed = useCallback(
    (text: string) => {
      trackFeatureAction("ai_speaking", "suggestion_used", {
        mode: sessionMode,
        length: text.length,
      });
    },
    [sessionMode, trackFeatureAction],
  );

  const trackPhonemeEvaluated = useCallback(
    (score: number) => {
      trackFeatureAction("ai_speaking", "pronunciation_evaluated", {
        mode: sessionMode,
        score,
      });
    },
    [sessionMode, trackFeatureAction],
  );

  const trackRepairCompleted = useCallback(() => {
    trackFeatureAction("ai_speaking", "error_repaired", { mode: sessionMode });
  }, [sessionMode, trackFeatureAction]);

  return {
    messages,
    lastSuggestions,
    setLastSuggestions,
    quota,
    quotaBlocked,
    refreshQuota,
    autoTtsEnabled,
    setAutoTts,
    retryUserText,
    sendUserText,
    retryLastSend,
    abortStream,
    streamStatus,
    trackSuggestionUsed,
    trackPhonemeEvaluated,
    trackRepairCompleted,
  };
}
