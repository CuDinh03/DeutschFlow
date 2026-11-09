"use client";

import { MicDeniedGuide } from '@/components/speaking/MicDeniedGuide';
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, ChevronDown, ChevronUp, Mic, SendHorizontal } from "lucide-react";
import { getAccessToken } from "@/lib/authSession";
import { apiMessage, httpStatus } from "@/lib/api";
import { aiSpeakingApi } from "@/lib/aiSpeakingApi";
import { weeklySpeakingApi, type WeeklyPromptResponse, type WeeklySubmissionResponse } from "@/lib/weeklySpeakingApi";
import { startRecorder, type RecorderHandle } from "@/lib/voiceRecorder";

type Props = {
  /** Must match learner CEFR band used on the backend (e.g. A2, B1). */
  cefrBand: string;
  /** Called after rubric grading succeeds — e.g. refresh history list on another page section. */
  onSubmitted?: () => void;
};

export function WeeklyChallengeCard({ cefrBand, onSubmitted }: Props) {
  const t = useTranslations("speaking");
  const [expanded, setExpanded] = useState(true);
  const [prompt, setPrompt] = useState<WeeklyPromptResponse | null>(null);
  const [fetched, setFetched] = useState(false);
  /**
   * R-W10: phân biệt "tuần này chưa có đề" (404 — trạng thái bình thường) với "tải hỏng"
   * (500/mất mạng). Trước đây catch chỉ xử lý 404 nên MỌI lỗi khác rơi vào khoảng trống:
   * `prompt` ở nguyên null ⇒ UI báo "chưa có đề tuần này" trong khi backend đang 500.
   */
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  /** Band có đề tuần này — chỉ tra khi 404 để empty-state nói thật (null = chưa tra xong). */
  const [availableBands, setAvailableBands] = useState<string[] | null>(null);

  const [transcript, setTranscript] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [result, setResult] = useState<WeeklySubmissionResponse | null>(null);

  const [weeklyRec, setWeeklyRec] = useState<"idle" | "listening" | "processing">("idle");
  const recorderRef = useRef<RecorderHandle | null>(null);

  useEffect(() => {
    setPrompt(null);
    setFetched(false);
    setLoadFailed(false);
    setResult(null);
    setTranscript("");
    setSubmitErr(null);

    if (!getAccessToken()) {
      setFetched(true);
      return;
    }

    let cancelled = false;
    weeklySpeakingApi
      .getCurrentPrompt(cefrBand)
      .then((res) => {
        if (!cancelled) setPrompt(res.data);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (httpStatus(e) === 404) {
          setPrompt(null);   // thật sự chưa có đề cho band này
          // QA 09/08 mục I: empty-state phải nói thật band nào ĐANG có đề, thay vì bắt
          // học viên bấm thử từng band (backend đã fallback band lân cận nên 404 thường
          // = cả tuần trống — tra để xác nhận).
          weeklySpeakingApi
            .getAvailableBands()
            .then((res) => {
              if (!cancelled) setAvailableBands(res.data ?? []);
            })
            .catch(() => {});
          return;
        }
        setLoadFailed(true); // tải hỏng — KHÔNG được hiển thị như "chưa có đề"
      })
      .finally(() => {
        if (!cancelled) setFetched(true);
      });

    return () => {
      cancelled = true;
    };
  }, [cefrBand, reloadKey]);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!prompt || result) return;
    const text = transcript.trim();
    if (!text) {
      setSubmitErr(t("weeklyTranscriptRequired"));
      return;
    }
    setSubmitting(true);
    setSubmitErr(null);
    try {
      const { data } = await weeklySpeakingApi.submit({
        promptId: prompt.id,
        transcript: text,
        audioDurationSec: null,
        cefrBand,
      });
      setResult(data);
      onSubmitted?.();
    } catch (e: unknown) {
      if (httpStatus(e) === 409) {
        setSubmitErr(t("weeklyAlreadySubmitted"));
      } else {
        setSubmitErr(apiMessage(e));
      }
    } finally {
      setSubmitting(false);
    }
  }, [prompt, transcript, result, cefrBand, t, onSubmitted]);

  const toggleWeeklyMic = useCallback(async () => {
    if (result || !prompt) return;
    if (weeklyRec === "listening") {
      recorderRef.current?.stop();
      return;
    }
    if (weeklyRec === "processing") return;

    try {
      const handle = await startRecorder((blob) => {
        recorderRef.current = null;
        setWeeklyRec("processing");
        aiSpeakingApi
          .transcribe(blob)
          .then((res) => {
            const txt = res.data.transcript?.trim();
            if (txt) setTranscript((prev) => (prev ? `${prev.trim()}\n${txt}` : txt));
          })
          .catch((e: unknown) => {
            setSubmitErr(apiMessage(e));
          })
          .finally(() => setWeeklyRec("idle"));
      });
      recorderRef.current = handle;
      setWeeklyRec("listening");
    } catch {
      setSubmitErr(t("microphoneDenied"));
      setWeeklyRec("idle");
    }
  }, [prompt, result, weeklyRec, t]);

  if (!fetched) return null;
  if (loadFailed) {
    return (
      <div
        role="alert"
        className="rounded-[20px] border border-ga-line bg-ga-surface p-6 text-center text-sm text-ga-muted"
      >
        <p>{t("weeklyLoadFailed")}</p>
        <button
          type="button"
          onClick={() => setReloadKey((v) => v + 1)}
          className="mt-3 rounded-full border border-ga-line-strong px-4 py-1.5 text-[13px] font-semibold text-ga-ink transition-colors hover:bg-ga-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {t("weeklyRetry")}
        </button>
      </div>
    );
  }
  if (!prompt) {
    return (
      <div className="rounded-[20px] border border-ga-line bg-ga-surface p-6 text-center text-sm text-ga-muted">
        {availableBands && availableBands.length > 0
          ? t("weeklyNoPromptOtherBands", { bands: availableBands.join(", ") })
          : t("weeklyNoPromptWeek")}
      </div>
    );
  }

  const tc = result?.rubric.task_completion;

  return (
    <div
      className="rounded-[20px] border border-ga-line bg-ga-card p-4"
    >
      <MicDeniedGuide className="mb-3" />
      <button
        type="button"
        className="w-full flex items-start justify-between gap-2 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold mb-2 bg-ga-side-active text-ga-muted">
            <CalendarDays size={11} className="text-ga-muted" aria-hidden /> {t("weeklyBadge")}
          </div>
          <h3 className="text-ga-ink font-bold text-sm leading-snug pr-2 break-words">{prompt.title}</h3>
          <p className="text-[11px] mt-1 text-ga-muted">
            {prompt.cefrBand} · {prompt.weekStartDate}
          </p>
        </div>
        {expanded ? (
          <ChevronUp size={18} className="text-ga-subtle flex-shrink-0 mt-1" aria-hidden />
        ) : (
          <ChevronDown size={18} className="text-ga-subtle flex-shrink-0 mt-1" aria-hidden />
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-ga-ink">
            {prompt.promptDe}
          </p>
          {prompt.mandatoryPoints?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide mb-1 text-ga-muted">
                {t("weeklyMandatory")}
              </p>
              <ul className="text-[12px] space-y-1 list-disc pl-4 text-ga-ink">
                {prompt.mandatoryPoints.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {prompt.optionalPoints?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide mb-1 text-ga-muted">
                {t("weeklyOptional")}
              </p>
              <ul className="text-[11px] space-y-0.5 list-disc pl-4 text-ga-muted">
                {prompt.optionalPoints.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {result ? (
            <div className="rounded-[14px] p-3 space-y-2 border border-ga-line bg-ga-surface">
              <p className="text-xs font-bold text-ga-ink">
                {t("weeklyResultTitle")} · {t("weeklyTaskScore", { n: tc?.score_1_to_5 ?? "—" })}
              </p>
              <p className="text-[12px] leading-relaxed text-ga-ink">
                {result.rubric.feedback_vi_summary}
              </p>
              {result.rubric.grammar?.summary_de ? (
                <p className="text-[11px] italic text-ga-muted">
                  {result.rubric.grammar.summary_de}
                </p>
              ) : null}
              <p className="text-[10px] text-ga-muted">{result.rubric.disclaimer_vi}</p>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  disabled={submitting || weeklyRec !== "idle"}
                  placeholder={t("weeklyTranscriptPlaceholder")}
                  rows={4}
                  className={`flex-1 min-w-0 px-3 py-2.5 rounded-[12px] text-[13px] outline-none resize-y border bg-ga-surface text-ga-ink caret-ga-ink placeholder:text-ga-subtle focus-visible:border-ga-ink focus-visible:ring-2 focus-visible:ring-ga-focus ${
                    transcript ? "border-ga-line-strong" : "border-ga-line"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => void toggleWeeklyMic()}
                  disabled={submitting}
                  className={`flex-shrink-0 w-11 h-11 rounded-[12px] flex items-center justify-center self-start border ${
                    weeklyRec === "listening"
                      ? "border-ga-red bg-ga-red-soft text-ga-red"
                      : weeklyRec === "processing"
                        ? "border-ga-line bg-ga-side-active text-ga-ink"
                        : "border-ga-line bg-ga-surface text-ga-ink"
                  }`}
                  title={weeklyRec === "listening" ? t("micPressToStop") : t("micPressToRecord")}
                >
                  <Mic size={18} aria-hidden />
                </button>
              </div>
              {weeklyRec === "listening" && (
                <p className="text-[11px] font-medium text-ga-red">{t("weeklyRecordingHint")}</p>
              )}
              {weeklyRec === "processing" && (
                <p className="text-[11px] text-ga-muted">{t("transcribing")}</p>
              )}
              {submitErr && <p className="text-[11px] text-ga-red">{submitErr}</p>}
              <button
                type="button"
                disabled={submitting || weeklyRec !== "idle"}
                onClick={() => void handleSubmit()}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-[14px] text-sm font-bold ${
                  submitting || weeklyRec !== "idle" ? "bg-ga-side-active text-ga-muted" : "bg-ga-ink text-ga-card"
                }`}
              >
                <SendHorizontal size={16} aria-hidden />
                {submitting ? t("weeklySubmitting") : t("weeklySubmit")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
