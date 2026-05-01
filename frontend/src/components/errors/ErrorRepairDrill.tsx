"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { scoreAttempt } from "@/lib/scoring/textScoring";
import { getDrillRule } from "@/lib/errors/drillRules";
import { getErrorSnippet } from "@/lib/errors/errorTaxonomy";
import { errorSkillsApi } from "@/lib/errors/drillApi";

interface Props {
  open: boolean;
  onClose: () => void;
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

  if (!open) return null;

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
          onClose();
        }, 500);
      }
    } else {
      setResult("fail");
    }
  };

  const handleClose = () => {
    if (blocking && result !== "pass") return;
    setAttempt("");
    setResult("idle");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-[20px] p-6 shadow-xl border border-white/10"
        style={{ background: "rgba(15,23,42,0.95)" }}
      >
        <h3 className="text-white font-bold text-lg mb-1">{snippet.title}</h3>
        <p className="text-xs font-mono text-cyan-300/90 mb-2">{errorCode}</p>
        <p className="text-sm text-white/70 mb-1">{snippet.rule}</p>
        {(ruleViShort || exampleCorrectDe) && (
          <p className="text-xs text-white/50 mb-4">
            {ruleViShort ? `${ruleViShort} ` : ""}
            {exampleCorrectDe ? `→ ${exampleCorrectDe}` : ""}
          </p>
        )}

        <label className="block text-xs font-semibold text-white/50 mb-2">
          {t("drillPrompt")}
        </label>
        <textarea
          value={attempt}
          onChange={(e) => {
            setAttempt(e.target.value);
            setResult("idle");
          }}
          rows={3}
          className="w-full rounded-xl px-3 py-2 text-sm bg-white/10 border border-white/15 text-white placeholder:text-white/30 mb-4"
          placeholder={target || "…"}
        />

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
            className="flex-[2] py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-violet-500 text-white disabled:opacity-40"
          >
            {t("drillSubmit")}
          </button>
        </div>
      </div>
    </div>
  );
}
