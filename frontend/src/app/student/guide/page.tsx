"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { spring, fadeUp } from "@/lib/motion";
import { useTranslations } from "next-intl";
import { Sparkles, ChevronDown, ArrowUpRight, PlayCircle } from "lucide-react";
import { StudentShell } from "@/components/layouts/StudentShell";
import { DeutschFlowLoader } from "@/components/ui/DeutschFlowLogo";
import { logout } from "@/lib/authSession";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import { usePageTimeTracker } from "@/hooks/usePageTimeTracker";
import { useTracking } from "@/hooks/useTracking";
import { GUIDE_FEATURES } from "@/components/guide/guideContent";
import { GUIDE_REPLAY_EVENT } from "@/components/guide/GuidedTour";

interface FaqItem {
  q: string;
  a: string;
}

export default function GuidePage() {
  usePageTimeTracker("guide");
  const t = useTranslations("guide");
  const { trackEvent } = useTracking();
  const { me, loading, targetLevel, streakDays, initials } = useStudentPracticeSession();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = (t.raw("page.faq") as FaqItem[]) ?? [];

  const replayTour = () => {
    trackEvent("guide_tour_replay_clicked", { from: "guide_page" });
    window.dispatchEvent(new Event(GUIDE_REPLAY_EVENT));
  };

  if (loading || !me) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F1F4F9]">
        <DeutschFlowLoader label={t("page.loading")} />
      </div>
    );
  }

  return (
    <StudentShell
      activeSection="guide"
      user={me}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={() => logout()}
      headerTitle={t("page.title")}
      headerSubtitle={t("page.subtitle")}
    >
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Replay tour banner */}
        <motion.div
          {...fadeUp}
          transition={spring.gentle}
          className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#121212] via-[#1A1A1A] to-[#262626] p-6 text-white shadow-lg"
        >
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[#FFCD00]/20 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[#FFCD00]">
                <Sparkles size={20} className="text-[#121212]" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold">{t("page.replayTitle")}</h2>
                <p className="mt-1 max-w-md text-sm text-white/70">{t("page.replayBody")}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={replayTour}
              className="inline-flex flex-shrink-0 items-center justify-center gap-2 self-start rounded-full bg-[#FFCD00] px-5 py-3 font-extrabold text-[#121212] shadow-[0_12px_30px_rgba(255,205,0,0.35)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <PlayCircle size={18} />
              {t("page.replayTour")}
            </button>
          </div>
        </motion.div>

        {/* Feature catalogue */}
        <section>
          <h2 className="mb-4 text-base font-bold text-[#0F172A]">{t("page.sectionsTitle")}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {GUIDE_FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.key}
                  {...fadeUp}
                  transition={{ ...spring.gentle, delay: i * 0.04 }}
                  className="group flex flex-col rounded-[20px] border border-[#E2E8F0] bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px]"
                      style={{
                        backgroundColor: `${feature.accent}1A`,
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5)`,
                      }}
                    >
                      <Icon size={20} style={{ color: feature.accent }} strokeWidth={2.2} />
                    </div>
                    <h3 className="text-[15px] font-bold tracking-tight text-[#0F172A]">
                      {t(`features.${feature.key}.title`)}
                    </h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#475569]">
                    {t(`features.${feature.key}.desc`)}
                  </p>
                  <div className="mt-3 rounded-xl bg-[#F8FAFC] px-3 py-2.5">
                    <p className="text-[13px] leading-5 text-[#64748B]">
                      <span className="font-semibold text-[#334155]">{t("page.howLabel")}: </span>
                      {t(`features.${feature.key}.how`)}
                    </p>
                  </div>
                  <Link
                    href={feature.href}
                    onClick={() => trackEvent("guide_feature_opened", { feature: feature.key })}
                    className="mt-4 inline-flex items-center gap-1.5 self-start text-[13px] font-bold transition-transform hover:translate-x-0.5"
                    style={{ color: feature.accent }}
                  >
                    {t("page.open")}
                    <ArrowUpRight size={15} />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* FAQ */}
        {faqs.length > 0 && (
          <section>
            <h2 className="mb-4 text-base font-bold text-[#0F172A]">{t("page.faqTitle")}</h2>
            <div className="overflow-hidden rounded-[20px] border border-[#E2E8F0] bg-white shadow-sm">
              {faqs.map((item, i) => {
                const isOpen = openFaq === i;
                return (
                  <div key={i} className={i > 0 ? "border-t border-[#F1F4F9]" : ""}>
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-[#F8FAFC]"
                      aria-expanded={isOpen}
                    >
                      <span className="text-sm font-semibold text-[#0F172A]">{item.q}</span>
                      <ChevronDown
                        size={18}
                        className="flex-shrink-0 text-[#94A3B8] transition-transform duration-200"
                        style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
                      />
                    </button>
                    <motion.div
                      initial={false}
                      animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-4 text-sm leading-6 text-[#475569]">{item.a}</p>
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </StudentShell>
  );
}
