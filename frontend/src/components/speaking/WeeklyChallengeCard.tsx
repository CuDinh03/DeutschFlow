"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Calendar, ChevronDown, ChevronUp, Mic, SendHorizontal } from "lucide-react";
import { getAccessToken } from "@/lib/authSession";
import { apiMessage, httpStatus } from "@/lib/api";
import { aiSpeakingApi } from "@/lib/aiSpeakingApi";
import { weeklySpeakingApi, type WeeklyPromptResponse, type WeeklySubmissionResponse } from "@/lib/weeklySpeakingApi";
import { startRecorder, type RecorderHandle } from "@/lib/voiceRecorder";
import { CYAN, PURPLE, glass } from "./types";

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

  const [transcript, setTranscript] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [result, setResult] = useState<WeeklySubmissionResponse | null>(null);

  const [weeklyRec, setWeeklyRec] = useState<"idle" | "listening" | "processing">("idle");
  const recorderRef = useRef<RecorderHandle | null>(null);

  useEffect(() => {
    setPrompt(null);
    setFetched(false);
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
          setPrompt(null);
          return;
        }
      })
      .finally(() => {
        if (!cancelled) setFetched(true);
      });

    return () => {
      cancelled = true;
    };
  }, [cefrBand]);

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
  if (!prompt) {
    return (
      <div
        className="rounded-[20px] p-6 text-center text-sm border"
        style={{ ...glass, border: `1px solid rgba(255,255,255,0.08)`, color: "rgba(255,255,255,0.5)" }}
      >
        {t("weeklyNoPrompt")}
      </div>
    );
  }

  const tc = result?.rubric.task_completion;

  return (
    <div className="rounded-[20px] p-4" style={{ ...glass, border: `1px solid ${CYAN}35` }}>
      <button
        type="button"
        className="w-full flex items-start justify-between gap-2 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div>
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold mb-2"
            style={{ background: `${PURPLE}22`, border: `1px solid ${PURPLE}45`, color: PURPLE }}
          >
            <Calendar size={11} /> {t("weeklyBadge")}
          </div>
          <h3 className="text-white font-bold text-sm leading-snug pr-2">{prompt.title}</h3>
          <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
            {prompt.cefrBand} · {prompt.weekStartDate}
          </p>
        </div>
        {expanded ? (
          <ChevronUp size={18} className="text-white/50 flex-shrink-0 mt-1" />
        ) : (
          <ChevronDown size={18} className="text-white/50 flex-shrink-0 mt-1" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: "rgba(255,255,255,0.85)" }}>
            {prompt.promptDe}
          </p>
          {prompt.mandatoryPoints?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: CYAN }}>
                {t("weeklyMandatory")}
              </p>
              <ul className="text-[12px] space-y-1 list-disc pl-4" style={{ color: "rgba(255,255,255,0.7)" }}>
                {prompt.mandatoryPoints.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {prompt.optionalPoints?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                {t("weeklyOptional")}
              </p>
              <ul className="text-[11px] space-y-0.5 list-disc pl-4" style={{ color: "rgba(255,255,255,0.5)" }}>
                {prompt.optionalPoints.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {result ? (
            <div className="rounded-[14px] p-3 space-y-2" style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.25)" }}>
              <p className="text-xs font-bold" style={{ color: CYAN }}>
                {t("weeklyResultTitle")} · {t("weeklyTaskScore", { n: tc?.score_1_to_5 ?? "—" })}
              </p>
              <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.88)" }}>
                {result.rubric.feedback_vi_summary}
              </p>
              {result.rubric.grammar?.summary_de ? (
                <p className="text-[11px] italic" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {result.rubric.grammar.summary_de}
                </p>
              ) : null}
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                {result.rubric.disclaimer_vi}
              </p>
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
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-[12px] text-[13px] outline-none resize-y"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: `1px solid ${transcript ? CYAN + "40" : "rgba(255,255,255,0.1)"}`,
                    color: "rgba(255,255,255,0.92)",
                    caretColor: CYAN,
                  }}
                />
                <button
                  type="button"
                  onClick={() => void toggleWeeklyMic()}
                  disabled={submitting}
                  className="flex-shrink-0 w-11 h-11 rounded-[12px] flex items-center justify-center self-start"
                  style={{
                    background:
                      weeklyRec === "listening"
                        ? "rgba(248,113,113,0.25)"
                        : weeklyRec === "processing"
                          ? "rgba(255,255,255,0.08)"
                          : "rgba(255,255,255,0.08)",
                    border: `1px solid ${weeklyRec === "listening" ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.12)"}`,
                    color: weeklyRec === "listening" ? "#fca5a5" : CYAN,
                  }}
                  title={weeklyRec === "listening" ? t("micPressToStop") : t("micPressToRecord")}
                >
                  <Mic size={18} />
                </button>
              </div>
              {weeklyRec === "listening" && (
                <p className="text-[11px] text-cyan-200/90">{t("weeklyRecordingHint")}</p>
              )}
              {weeklyRec === "processing" && (
                <p className="text-[11px] text-white/50">{t("transcribing")}</p>
              )}
              {submitErr && <p className="text-[11px] text-red-300/90">{submitErr}</p>}
              <button
                type="button"
                disabled={submitting || weeklyRec !== "idle"}
                onClick={() => void handleSubmit()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-[14px] text-sm font-bold"
                style={{
                  background:
                    submitting || weeklyRec !== "idle" ? "rgba(255,255,255,0.08)" : `linear-gradient(135deg, ${CYAN}, ${PURPLE})`,
                  color: "white",
                  opacity: submitting || weeklyRec !== "idle" ? 0.6 : 1,
                }}
              >
                <SendHorizontal size={16} />
                {submitting ? t("weeklySubmitting") : t("weeklySubmit")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
