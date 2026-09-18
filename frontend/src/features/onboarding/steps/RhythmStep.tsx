"use client";

import type { RefObject } from "react";
import { useTranslations } from "next-intl";
import { DAILY_GOAL_OPTIONS } from "../wizardModel";
import { cardCls, headingCls, subCls, tileCls } from "./stepStyles";

interface Props {
  value: number;
  onChange: (minutes: number) => void;
  currentLevel: string;
  headingRef: RefObject<HTMLHeadingElement>;
}

/** Bước 3 — "Mỗi ngày bao nhiêu phút?" (`dailyGoalMinutes`, neo của streak — khớp mobile). */
export function RhythmStep({ value, onChange, currentLevel, headingRef }: Props) {
  const t = useTranslations("v2.onboarding");
  return (
    <fieldset className={cardCls}>
      {/* legend chứa chính h1: đầu đọc màn hình đọc một lần, không lặp (legend cho phép heading content). */}
      <legend className="contents"><h1 ref={headingRef} tabIndex={-1} className={headingCls}>{t("rhythm.heading")}</h1></legend>
      <p className={subCls}>{t("rhythm.sub")}</p>
      <div role="radiogroup" aria-label={t("rhythm.heading")} className="grid grid-cols-2 gap-2">
        {DAILY_GOAL_OPTIONS.map((m) => (
          <button key={m} type="button" role="radio" aria-checked={value === m} onClick={() => onChange(m)} className={`${tileCls(value === m)} text-left`}>
            <p className="ga-ui text-ga-numeral text-ga-ink">
              {m} <span className="text-ga-caption font-normal text-ga-muted">{t("rhythm.minutes")}</span>
            </p>
            <p className="text-ga-caption text-ga-muted">{t(`rhythm.m${m}`)}</p>
          </button>
        ))}
      </div>
      {currentLevel === "A0"
        ? <div className="rounded-ga border border-ga-green bg-ga-green-soft p-3"><p className="text-ga-caption text-ga-ink">{t.rich("pace.noteA0", { b: (chunks) => <strong>{chunks}</strong> })}</p></div>
        : <div className="rounded-ga border border-ga-gold bg-ga-yellow-soft p-3"><p className="text-ga-caption text-ga-ink">{t.rich("pace.notePlacement", { b: (chunks) => <strong>{chunks}</strong> })}</p></div>
      }
    </fieldset>
  );
}
