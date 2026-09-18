"use client";

import type { RefObject } from "react";
import { useTranslations } from "next-intl";
import { GaIcon } from "@/components/ui-v2";
import { MOTIVATIONS } from "../wizardModel";
import { cardCls, headingCls, subCls, tileCls } from "./stepStyles";

interface Props {
  value: string;
  onChange: (motivation: string) => void;
  headingRef: RefObject<HTMLHeadingElement>;
}

/** Bước 1 — "Vì sao bạn học tiếng Đức?" (điểm neo cảm xúc; goalType suy ra từ đây). */
export function MotivationStep({ value, onChange, headingRef }: Props) {
  const t = useTranslations("v2.onboarding");
  return (
    <fieldset className={cardCls}>
      {/* legend chứa chính h1: đầu đọc màn hình đọc một lần, không lặp (legend cho phép heading content). */}
      <legend className="contents"><h1 ref={headingRef} tabIndex={-1} className={headingCls}>{t("goal.heading")}</h1></legend>
      <p className={subCls}>{t("goal.sub")}</p>
      <div role="radiogroup" aria-label={t("goal.heading")} className="grid grid-cols-2 gap-2">
        {MOTIVATIONS.map((m) => (
          <button key={m.value} type="button" role="radio" aria-checked={value === m.value} onClick={() => onChange(m.value)} className={tileCls(value === m.value)}>
            <GaIcon name={m.icon} size={22} className="mx-auto mb-1 text-ga-muted" />
            <p className="ga-ui text-ga-caption font-bold leading-tight text-ga-ink">{t(`goal.${m.value}`)}</p>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
