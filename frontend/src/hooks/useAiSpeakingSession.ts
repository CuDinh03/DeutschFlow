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
    setStreamErrorMessage,
    setMessages,
  } = useChatStore();

  const [lastSuggestions, setLastSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
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
      setStreamErrorMessage(null);
      // Đ4: gợi ý thuộc về câu hỏi CŨ — xoá ngay khi gửi lượt mới để nút "Gợi ý" không
      // hiện lại chip của lượt trước cho câu hỏi mới.
      setLastSuggestions([]);
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
        (err, info) => {
          // Audit 24/07 (R-W5): phân loại theo mã lỗi backend, không chỉ đoán chuỗi "429". Hết
          // lượt / vượt tần suất → làm mới quota (mở luồng nâng cấp/đếm ngược ở tầng trên).
          // 2 kênh token (26/07): ORG_BUDGET_* là ngân sách trung tâm (staff) — message backend
          // hiển thị nguyên văn qua StreamStatusIndicator, không có CTA nâng cấp cá nhân.
          const code = info?.code;
          if (
            code === "QUOTA_EXCEEDED" ||
            code === "RATE_LIMITED" ||
            code === "ORG_BUDGET_EXHAUSTED" ||
            code === "ORG_BUDGET_NOT_CONFIGURED" ||
            err.includes("429")
          ) {
            void refreshQuota();
          }
          if (err === AI_SPEAKING_STREAM_STALLED) {
            removeStreamingPlaceholder();
            setStreamStatus("stalled");
            setRetryUserText(trimmed);
            trackFeatureAction("ai_speaking", "stream_stalled", { mode: sessionMode });
            return;
          }
          // Audit speaking 24/07 (R-W1/R-W2): lỗi stream không còn là hố hút. Gỡ shell AI rỗng
          // (giữ phần đã stream dở nếu có), và giữ lại text vừa gửi để nút "Gửi lại" hoạt động —
          // trước đây draft bị xoá trước khi gửi nên turn fail là user mất trắng câu vừa soạn,
          // còn chip "try again" không có hành động nào.
          if (currentDe) {
            updateLastMessage({ contentDe: currentDe, isStreaming: false });
          } else {
            removeStreamingPlaceholder();
          }
          // R-W5: hiển thị câu tiếng Việt thân thiện của backend (nếu có) thay vì chip generic
          // "Connection error" — user biết chính xác nên chờ, nâng cấp, hay thử lại.
          setStreamErrorMessage(info?.message ?? null);
          setStreamStatus("error");
          setRetryUserText(trimmed);
          trackFeatureAction("ai_speaking", "stream_error", { mode: sessionMode });
          console.error("Chat stream error:", err);
        },
        (frame) => {
          audioStreamed = true;
          audioQueue?.enqueue(frame);
        },
        autoTtsEnabled,
        () => {
          // Backend confirmed streaming audio is coming → suppress on-device TTS at "done"
          // (audio events arrive after "done", so we can't infer this from their arrival).
          audioStreamed = true;
        },
      );
    },
    [
      addMessage,
      updateLastMessage,
      updateLastUserMessage,
      setStreamStatus,
      setStreamErrorMessage,
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

  /**
   * Đ4: lấy 2 gợi ý cho câu hỏi AI gần nhất — chỉ khi học viên bấm nút (backend mặc định
   * không sinh kèm lượt chat nữa). Đã có gợi ý (mode "always" hoặc bấm rồi) thì không gọi lại.
   * Lỗi giữ im lặng: nút vẫn còn để bấm lại, lỗi hạn mức đã có toast tầng api chung.
   */
  const requestSuggestions = useCallback(async () => {
    const sid = useChatStore.getState().sessionId;
    if (!sid || suggestionsLoading || lastSuggestions.length > 0) return;
    setSuggestionsLoading(true);
    try {
      const sugs = await aiSpeakingApi.fetchSuggestions(sid);
      setLastSuggestions(sugs);
      trackFeatureAction("ai_speaking", "suggestions_requested", { mode: sessionMode });
    } catch {
      // giữ nút — người học bấm lại được
    } finally {
      setSuggestionsLoading(false);
    }
  }, [suggestionsLoading, lastSuggestions.length, sessionMode, trackFeatureAction]);

  return {
    messages,
    lastSuggestions,
    setLastSuggestions,
    suggestionsLoading,
    requestSuggestions,
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
