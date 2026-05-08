"use client";

import { useState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { scoreAttempt } from "@/lib/scoring/textScoring";
import { getDrillRule } from "@/lib/errors/drillRules";
import { getErrorSnippet } from "@/lib/errors/errorTaxonomy";
import { errorSkillsApi } from "@/lib/errors/drillApi";
import { startRecorder, RecorderHandle } from "@/lib/voiceRecorder";
import { aiSpeakingApi } from "@/lib/aiSpeakingApi";
import { apiMessage } from "@/lib/api";
import { Mic, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: (passed: boolean) => void;
  errorCode: string;
  /** Prefer API-provided example sentence */
  exampleCorrectDe?: string | null;
  ruleViShort?: string | null;
  /** When true, learner must pass the drill before closing (speaking adaptive gate). */
  blocking?: boolean;
}

export default function ErrorRepairDrill({
  open,
  onClose,
  errorCode,
  exampleCorrectDe,
  ruleViShort,
  blocking = false,
}: Props) {
  const t = useTranslations("speaking");
  const locale = useLocale();
  const snippet = getErrorSnippet(errorCode, locale);
  const drill = getDrillRule(errorCode);
  const target =
    drill?.rewriteTarget_de ??
    exampleCorrectDe ??
    "";

  const [attempt, setAttempt] = useState("");
  const [result, setResult] = useState<"idle" | "pass" | "fail">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recorderRef = useRef<RecorderHandle | null>(null);

  if (!open) return null;

  const handleToggleMic = async () => {
    if (isRecording) {
      recorderRef.current?.stop();
      return;
    }
    
    try {
      const handle = await startRecorder(async (blob) => {
        setIsRecording(false);
        setIsTranscribing(true);
        try {
          const res = await aiSpeakingApi.transcribe(blob);
          if (res.data.transcript) {
            setAttempt(res.data.transcript.trim());
            setResult("idle");
          }
        } catch (e) {
          console.error("Transcription failed", e);
        } finally {
          setIsTranscribing(false);
        }
      });
      recorderRef.current = handle;
      setIsRecording(true);
    } catch {
      console.error("Mic denied");
    }
  };

  const handleCheck = async () => {
    const res = scoreAttempt(attempt, target, drill?.scoring);
    if (res.pass) {
      setResult("pass");
      setSubmitting(true);
      try {
        await errorSkillsApi.repairAttempt(errorCode);
      } catch {
        /* non-fatal */
      } finally {
        setSubmitting(false);
      }
      if (blocking) {
        setTimeout(() => {
          setAttempt("");
          setResult("idle");
          onClose(true);
        }, 500);
      }
    } else {
      setResult("fail");
    }
  };

  const handleClose = () => {
    if (blocking && result !== "pass") return;
    const isPassed = result === "pass";
    setAttempt("");
    setResult("idle");
    onClose(isPassed);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-[20px] p-6 shadow-xl border border-white/10"
        style={{ background: "rgba(15,23,42,0.95)" }}
      >
        <h3 className="text-white font-bold text-lg mb-1">{snippet.title}</h3>
        <p className="text-xs font-mono text-amber-300/90 mb-2">{errorCode}</p>
        <p className="text-sm text-white/70 mb-1">{snippet.rule}</p>
        {(ruleViShort || exampleCorrectDe) && (
          <p className="text-xs text-white/50 mb-4">
            {ruleViShort ? `${ruleViShort} ` : ""}
            {exampleCorrectDe ? `→ ${exampleCorrectDe}` : ""}
          </p>
        )}

        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-semibold text-white/50">
            {t("drillPrompt")} (Gõ phím hoặc Đọc to)
          </label>
        </div>
        
        <div className="relative mb-4">
          <textarea
            value={attempt}
            onChange={(e) => {
              setAttempt(e.target.value);
              setResult("idle");
            }}
            rows={3}
            className="w-full rounded-xl px-3 py-2 pr-12 text-sm bg-white/10 border border-white/15 text-white placeholder:text-white/30"
            placeholder={target || "…"}
            disabled={isTranscribing}
          />
          <button
            type="button"
            onClick={handleToggleMic}
            disabled={isTranscribing}
            className={`absolute right-2 bottom-2 p-2 rounded-lg transition-colors ${
              isRecording 
                ? "bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse" 
                : "bg-white/5 text-white/50 hover:text-white/80 border border-transparent"
            }`}
          >
            {isTranscribing ? <Loader2 size={18} className="animate-spin" /> : <Mic size={18} />}
          </button>
        </div>

        {result === "pass" && (
          <p className="text-sm font-semibold text-emerald-400 mb-3">{t("drillGood")}</p>
        )}
        {result === "fail" && (
          <p className="text-sm font-semibold text-amber-400 mb-3">{t("drillRetry")}</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={blocking && result !== "pass"}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white/10 text-white/80 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {blocking && result !== "pass" ? t("drillCloseBlocked") : t("drillClose")}
          </button>
          <button
            type="button"
            disabled={submitting || !attempt.trim()}
            onClick={handleCheck}
            className="flex-[2] py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-500 to-yellow-400 text-white disabled:opacity-40"
          >
            {t("drillSubmit")}
          </button>
        </div>
      </div>
    </div>
  );
}
