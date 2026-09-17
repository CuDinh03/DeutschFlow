"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { GaBtn, GaIcon } from "@/components/ui-v2";
import {
  liteProfilePayload,
  normalizePresetLevel,
  type OnboardingContext,
} from "@/features/onboarding/context";

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE_LITE — bản rút gọn cho học viên trung tâm (Đợt 5, kế hoạch 17/09/2026 §4.1 C2).
//
// Trung tâm/giáo trình quyết mục tiêu, lĩnh vực và mentor, nên màn này KHÔNG hỏi ba thứ đó:
// chỉ nhịp học, cộng một câu trình độ khi server chưa có (`presetCurrentLevel` null). Sau khi
// lưu, học viên đi thẳng bài đầu (I-11: không qua TASTE/PATH_CHOICE) — trang cha lo điều hướng.
// Tách khỏi page.tsx để wizard đầy đủ (741 dòng) không phình thêm một nhánh JSX nữa.
// ─────────────────────────────────────────────────────────────────────────────

/** Cùng bộ mức và icon với bước 1 của wizard đầy đủ — nhãn ở `level.<mã>.label|desc`. */
const LITE_LEVELS = [
  { value: "A0", icon: "eco" },
  { value: "A1", icon: "menu_book" },
  { value: "A2", icon: "forum" },
  { value: "B1", icon: "record_voice_over" },
  { value: "B2", icon: "school" },
];

/** Cùng ba nhịp với bước 3 của wizard đầy đủ — nhãn ở `pace.w<n>.label|desc`. */
const WEEKLY = [
  { value: 3, icon: "local_fire_department" },
  { value: 5, icon: "bolt" },
  { value: 7, icon: "rocket" },
];

export type LiteProfilePayload = ReturnType<typeof liteProfilePayload>;

interface Props {
  ctx: OnboardingContext;
  loading: boolean;
  /** Trả true khi hồ sơ đã nằm trên server; false = lỗi đã được báo, giữ nguyên màn. */
  onSubmit: (payload: LiteProfilePayload) => Promise<boolean>;
}

export function OrgLiteWizard({ ctx, loading, onSubmit }: Props) {
  const t = useTranslations("v2.onboarding");
  const locale = useLocale();
  const preset = normalizePresetLevel(ctx.presetCurrentLevel);
  const [currentLevel, setCurrentLevel] = useState<string>(preset ?? "A0");
  const [weeklyTarget, setWeeklyTarget] = useState(5);
  const dailyGoalMinutes = weeklyTarget >= 7 ? 20 : weeklyTarget >= 5 ? 15 : 10;

  const orgName = ctx.org?.name ?? "";
  const className = ctx.org?.className ?? "";
  const trialUntil = ctx.trial?.isTrial && ctx.trial.trialEndsAt
    ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(ctx.trial.trialEndsAt))
    : null;

  const card = "rounded-ga border border-ga-line bg-ga-card p-4 lg:p-6 shadow-ga-card-hover space-y-4";
  const sel = (v: boolean) => `w-full flex items-center gap-3 p-3 rounded-ga border text-left transition-colors duration-150 ${v ? "border-ga-gold bg-ga-yellow-soft" : "border-ga-line hover:border-ga-subtle"}`;
  const btnWrap = "h-auto min-h-[44px] whitespace-normal py-2.5 text-center lg:h-11 lg:whitespace-nowrap lg:py-0";

  return (
    <div className="mx-auto w-full max-w-lg overflow-x-clip space-y-4" data-testid="org-lite-wizard">
      <section className="rounded-ga border border-ga-gold bg-ga-yellow-soft p-4" aria-labelledby="org-lite-heading">
        <p className="ga-ui text-[10.5px] uppercase tracking-[0.08em] text-ga-muted font-semibold">{t("orgLite.cap")}</p>
        <h1 id="org-lite-heading" className="mt-1 font-ga-display text-[24px] font-medium text-ga-ink">
          {className ? t("orgLite.heading", { className }) : t("orgLite.headingNoClass", { orgName })}
        </h1>
        {className && orgName ? (
          <p className="ga-ui mt-1 text-[13.5px] font-semibold text-ga-ink">{t("orgLite.orgLine", { orgName })}</p>
        ) : null}
        <p className="mt-2 text-[13.5px] text-ga-muted">{t("orgLite.sub")}</p>
        {trialUntil ? <p className="mt-2 text-[12px] text-ga-ink">{t("orgLite.trialUntil", { date: trialUntil })}</p> : null}
      </section>

      {preset === null ? (
        <section className={card} aria-labelledby="org-lite-level">
          <h2 id="org-lite-level" className="font-ga-display text-[20px] font-medium text-ga-ink">{t("orgLite.levelHeading")}</h2>
          <p className="text-[13.5px] text-ga-muted">{t("orgLite.levelSub")}</p>
          {LITE_LEVELS.map((l) => (
            <button key={l.value} type="button" aria-pressed={currentLevel === l.value} onClick={() => setCurrentLevel(l.value)} className={sel(currentLevel === l.value)}>
              <GaIcon name={l.icon} size={22} className="text-ga-muted" />
              <div className="min-w-0 flex-1">
                <p className="ga-ui text-[13.5px] font-bold text-ga-ink">{t(`level.${l.value}.label`)}</p>
                <p className="text-[12px] text-ga-muted">{t(`level.${l.value}.desc`)}</p>
              </div>
              {currentLevel === l.value && <CheckCircle size={18} className="text-ga-gold" />}
            </button>
          ))}
        </section>
      ) : (
        <p className="ga-ui text-[12.5px] text-ga-muted px-1">{t("orgLite.levelPreset", { level: preset })}</p>
      )}

      <section className={card} aria-labelledby="org-lite-pace">
        <h2 id="org-lite-pace" className="font-ga-display text-[20px] font-medium text-ga-ink">{t("orgLite.paceHeading")}</h2>
        {WEEKLY.map((w) => (
          <button key={w.value} type="button" aria-pressed={weeklyTarget === w.value} onClick={() => setWeeklyTarget(w.value)} className={sel(weeklyTarget === w.value)}>
            <GaIcon name={w.icon} size={24} className="text-ga-muted" />
            <div className="min-w-0 flex-1">
              <p className="ga-ui text-[13.5px] font-bold text-ga-ink">{t(`pace.w${w.value}.label`)}</p>
              <p className="text-[12px] text-ga-muted">{t(`pace.w${w.value}.desc`)}</p>
            </div>
          </button>
        ))}
      </section>

      <GaBtn
        variant="ink"
        size="lg"
        className={`w-full ${btnWrap}`}
        loading={loading}
        disabled={loading}
        onClick={() => { void onSubmit(liteProfilePayload({ currentLevel, sessionsPerWeek: weeklyTarget, dailyGoalMinutes })); }}
      >
        {t("orgLite.cta")} <ArrowRight size={14} />
      </GaBtn>
    </div>
  );
}
