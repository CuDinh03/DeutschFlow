"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import api from "@/lib/api";
import { getAccessToken, clearTokens } from "@/lib/authSession";
import { errorSkillsApi, type ErrorSkillDto } from "@/lib/errors/drillApi";
import { getErrorSnippet } from "@/lib/errors/errorTaxonomy";
import ErrorRepairDrill from "@/components/errors/ErrorRepairDrill";
import { StudentShell } from "@/components/layouts/StudentShell";
import { toastApiError } from "@/lib/toastApiError";

const GLASS_ENTER = {
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  transition: { type: "spring" as const, stiffness: 380, damping: 34, mass: 0.85 },
};

function formatSeen(iso: string | undefined, locale: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : locale === "de" ? "de-DE" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return iso;
  }
}

export default function StudentErrorsPage() {
  const router = useRouter();
  const t = useTranslations("student");
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const [me, setMe] = useState<{ displayName: string; role: string } | null>(null);
  const [targetLevel, setTargetLevel] = useState("A1");
  const [streakDays, setStreakDays] = useState(0);
  const [skills, setSkills] = useState<ErrorSkillDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillCode, setDrillCode] = useState("");
  const [drillExample, setDrillExample] = useState<string | undefined>();
  const [drillRule, setDrillRule] = useState<string | undefined>();

  const sortedSkills = useMemo(
    () => [...skills].sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0) || b.count - a.count),
    [skills],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, planRes, dashRes, errorsRes] = await Promise.all([
        api.get("/auth/me"),
        api.get<{ plan?: { targetLevel?: string } }>("/plan/me").catch(() => null),
        api.get<{ streakDays?: number }>("/student/dashboard").catch(() => null),
        errorSkillsApi.getMine(30),
      ]);
      setMe(meRes.data);
      setTargetLevel(planRes?.data?.plan?.targetLevel ?? "A1");
      setStreakDays(Number(dashRes?.data?.streakDays ?? 0));
      setSkills(Array.isArray(errorsRes.data) ? errorsRes.data : []);
    } catch (err) {
      console.error("ErrorsPage fetch failed", err);
      toastApiError(err, { locale });
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    void loadAll();
  }, [router, loadAll]);

  const initials = useMemo(() => {
    return (me?.displayName ?? "U")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [me?.displayName]);

  if (!me && !loading) return null;

  const glassMotionProps = reduceMotion
    ? { initial: false as const }
    : {
        initial: GLASS_ENTER.initial,
        animate: GLASS_ENTER.animate,
        transition: GLASS_ENTER.transition,
      };

  return (
    <StudentShell
      activeSection="errors"
      user={me || { displayName: "User", role: "STUDENT" }}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={() => {
        clearTokens();
        router.push("/login");
      }}
      headerTitle={t("navMyErrors")}
      headerSubtitle={t("errorLibrarySubtitle")}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <motion.div
          {...glassMotionProps}
          className="df-glass-subtle overflow-hidden rounded-[22px] border-2 border-amber-400/35 bg-gradient-to-br from-amber-50/95 via-white/90 to-orange-50/40 p-6 shadow-lg shadow-amber-900/10"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-500/15">
                <AlertTriangle className="text-amber-700" size={28} strokeWidth={2.2} aria-hidden />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-amber-900/80">{t("todayTasksErrorBadge")}</p>
                <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">{t("errorLibraryTitle")}</h1>
                <p className="mt-1 max-w-xl text-sm text-[#64748B]">{t("errorLibrarySubtitle")}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push("/speaking")}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-300/70 bg-white/90 px-4 py-2.5 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-white"
              >
                {t("reviewTasksOpenSpeaking")}
                <ArrowRight size={16} />
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void loadAll()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#334155] hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden />
                {t("retry")}
              </button>
            </div>
          </div>
        </motion.div>

        {loading ? (
          <motion.div
            {...(reduceMotion ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: GLASS_ENTER.transition })}
            className="flex justify-center py-24"
          >
            <div className="h-11 w-11 animate-spin rounded-full border-4 border-[#00305E]/15 border-t-[#00305E]" />
          </motion.div>
        ) : sortedSkills.length === 0 ? (
          <motion.div
            {...glassMotionProps}
            className="df-glass-subtle rounded-[22px] border-2 border-dashed border-amber-200/80 bg-white/70 px-6 py-16 text-center shadow-md shadow-amber-900/5"
          >
            <p className="text-[#64748B]">{t("errorLibraryEmpty")}</p>
          </motion.div>
        ) : (
          <motion.ul
            variants={
              reduceMotion
                ? undefined
                : {
                    hidden: {},
                    show: {
                      transition: { staggerChildren: 0.07, delayChildren: 0.05 },
                    },
                  }
            }
            initial={reduceMotion ? undefined : "hidden"}
            animate={reduceMotion ? undefined : "show"}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            {sortedSkills.map((s) => {
              const snippet = getErrorSnippet(s.errorCode, locale);
              return (
                <motion.li
                  key={s.errorCode}
                  variants={
                    reduceMotion
                      ? undefined
                      : {
                          hidden: { opacity: 0, y: 24 },
                          show: {
                            opacity: 1,
                            y: 0,
                            transition: { type: "spring", stiffness: 420, damping: 32 },
                          },
                        }
                  }
                  className="group df-glass-subtle flex flex-col rounded-[20px] border-2 border-amber-200/80 bg-white/85 p-5 shadow-md shadow-amber-900/5 backdrop-blur-md transition hover:border-amber-400/50 hover:shadow-lg"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-[#0f172a] group-hover:text-[#92400e]">{snippet.title}</h2>
                      <p className="font-mono text-[10px] uppercase tracking-wider text-amber-800/80">{s.errorCode}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-amber-300/60 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-950">
                      {t("errorLibraryCount")} ×{s.count}
                    </span>
                  </div>

                  <p className="mb-3 text-xs text-[#64748B]">
                    {t("errorLibraryLastSeen")}:{" "}
                    <span className="font-medium text-[#334155]">{formatSeen(s.lastSeenAt, locale)}</span>
                  </p>

                  {(s.ruleViShort || s.sampleCorrected) && (
                    <div className="mb-4 space-y-2 rounded-xl border border-amber-100 bg-amber-50/80 p-3 text-sm text-[#475569]">
                      {s.ruleViShort ? (
                        <p>
                          <span className="font-semibold text-amber-950">{t("errorLibraryRule")}:</span> {s.ruleViShort}
                        </p>
                      ) : null}
                      {s.sampleCorrected ? (
                        <p className="font-medium text-emerald-800">
                          <span className="text-emerald-950">{t("errorLibrarySampleFix")}:</span> {s.sampleCorrected}
                        </p>
                      ) : null}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setDrillCode(s.errorCode);
                      setDrillExample(s.sampleCorrected ?? undefined);
                      setDrillRule(s.ruleViShort ?? undefined);
                      setDrillOpen(true);
                    }}
                    className="mt-auto w-full rounded-xl bg-[#00305E] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#004080]"
                  >
                    {t("practiceTwoMin")}
                  </button>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </div>

      <ErrorRepairDrill
        open={drillOpen}
        onClose={() => setDrillOpen(false)}
        errorCode={drillCode}
        exampleCorrectDe={drillExample}
        ruleViShort={drillRule}
      />
    </StudentShell>
  );
}
