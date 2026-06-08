"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { spring } from "@/lib/motion";
import { useTranslations } from "next-intl";
import { ArrowRight, ArrowLeft, X, Sparkles, ArrowUpRight } from "lucide-react";
import { useTracking } from "@/hooks/useTracking";
import { TOUR_STEPS } from "./guideContent";

const STORAGE_KEY = "df_guide_tour_done_v1";
/** Window event other student pages dispatch to re-open the tour on demand. */
export const GUIDE_REPLAY_EVENT = "df-guide-replay";

function hasSeenTour(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

function markTourSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* storage unavailable (private mode) — tour simply shows again next time */
  }
}

/**
 * One-time welcome walkthrough. Mounted app-wide via StudentShell: auto-opens
 * once for new learners, and re-opens whenever a `GUIDE_REPLAY_EVENT` is
 * dispatched (e.g. from the help page). Persistence is best-effort localStorage.
 */
export function GuidedTour() {
  const t = useTranslations("guide");
  const router = useRouter();
  const { trackEvent } = useTracking();
  const [open, setOpen] = useState(false);
  // Step 0 is the welcome screen; steps 1..N map to TOUR_STEPS.
  const [index, setIndex] = useState(0);

  // Auto-open once for first-time users, after mount (client-only). The ref
  // guard makes this a true one-shot, so a later re-render can never snap an
  // in-progress tour back to the welcome slide.
  const didAutoOpen = useRef(false);
  useEffect(() => {
    if (didAutoOpen.current || hasSeenTour()) return;
    didAutoOpen.current = true;
    setOpen(true);
    setIndex(0);
    trackEvent("guide_tour_started", { trigger: "auto" });
  }, [trackEvent]);

  // Allow other pages to replay the tour.
  useEffect(() => {
    const onReplay = () => {
      setIndex(0);
      setOpen(true);
      trackEvent("guide_tour_started", { trigger: "replay" });
    };
    window.addEventListener(GUIDE_REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(GUIDE_REPLAY_EVENT, onReplay);
  }, [trackEvent]);

  const totalSlides = TOUR_STEPS.length + 1; // welcome + feature steps
  const isWelcome = index === 0;
  const isLast = index === totalSlides - 1;

  const finish = useCallback(
    (reason: "completed" | "skipped") => {
      markTourSeen();
      setOpen(false);
      trackEvent("guide_tour_finished", { reason, last_step: index });
    },
    [index, trackEvent],
  );

  const goNext = useCallback(() => {
    if (isLast) {
      finish("completed");
      return;
    }
    setIndex((i) => i + 1);
  }, [isLast, finish]);

  const goBack = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  const openFeature = useCallback(
    (href: string) => {
      finish("completed");
      router.push(href);
    },
    [finish, router],
  );

  const step = isWelcome ? null : TOUR_STEPS[index - 1];
  const accent = step?.accent ?? "#E5A100";
  const StepIcon = step?.icon ?? Sparkles;

  return (
    <AnimatePresence>
      {open && (
      <motion.div
        key="guide-tour"
        className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="dialog"
        aria-modal="true"
        aria-label={t("tour.aria")}
      >
        {/* Backdrop */}
        <button
          type="button"
          aria-label={t("tour.skip")}
          onClick={() => finish("skipped")}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        <motion.div
          className="relative w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-[0_24px_70px_rgba(0,0,0,0.35)]"
          initial={{ y: 40, scale: 0.96, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 20, scale: 0.97, opacity: 0 }}
          transition={spring.snappy}
        >
          {/* Decorative header band */}
          <div
            className="relative h-2 w-full"
            style={{ background: `linear-gradient(90deg, ${accent}, #FFCD00)` }}
          />

          {/* Skip */}
          <button
            type="button"
            onClick={() => finish("skipped")}
            className="absolute right-3 top-5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-[#64748B] transition-colors hover:bg-black/10 hover:text-[#0F172A]"
            aria-label={t("tour.skip")}
          >
            <X size={16} />
          </button>

          <div className="px-6 pb-6 pt-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                {/* Icon chip */}
                <div
                  className="mb-5 flex h-16 w-16 items-center justify-center rounded-[20px]"
                  style={{
                    backgroundColor: `${accent}1A`,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 8px 20px ${accent}26`,
                  }}
                >
                  <StepIcon size={30} style={{ color: accent }} strokeWidth={2.2} />
                </div>

                {isWelcome ? (
                  <>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#94A3B8]">
                      {t("tour.welcomeKicker")}
                    </p>
                    <h2 className="text-2xl font-extrabold leading-tight text-[#0F172A]">
                      {t("tour.welcomeTitle")}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[#475569]">
                      {t("tour.welcomeBody")}
                    </p>
                  </>
                ) : (
                  <>
                    <p
                      className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em]"
                      style={{ color: accent }}
                    >
                      {t("tour.stepLabel", { current: index, total: TOUR_STEPS.length })}
                    </p>
                    <h2 className="text-2xl font-extrabold leading-tight text-[#0F172A]">
                      {t(`features.${step!.key}.title`)}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[#475569]">
                      {t(`features.${step!.key}.desc`)}
                    </p>
                    <button
                      type="button"
                      onClick={() => openFeature(step!.href)}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold transition-transform hover:scale-[1.02] active:scale-[0.98]"
                      style={{ backgroundColor: `${accent}14`, color: accent }}
                    >
                      {t("tour.openFeature")}
                      <ArrowUpRight size={15} />
                    </button>
                  </>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Progress dots */}
            <div className="mt-7 flex items-center justify-center gap-1.5">
              {Array.from({ length: totalSlides }).map((_, i) => (
                <span
                  key={i}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: i === index ? 22 : 6,
                    backgroundColor: i === index ? accent : "#E2E8F0",
                  }}
                />
              ))}
            </div>

            {/* Controls */}
            <div className="mt-5 flex items-center justify-between gap-3">
              {index > 0 ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="flex items-center gap-1 text-sm font-semibold text-[#64748B] transition-colors hover:text-[#0F172A]"
                >
                  <ArrowLeft size={15} /> {t("tour.back")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => finish("skipped")}
                  className="text-sm font-semibold text-[#94A3B8] transition-colors hover:text-[#64748B]"
                >
                  {t("tour.skip")}
                </button>
              )}

              <button
                type="button"
                onClick={goNext}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#121212] px-6 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {isLast ? t("tour.start") : t("tour.next")}
                {!isLast && <ArrowRight size={15} />}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
