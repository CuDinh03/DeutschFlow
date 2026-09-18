"use client";

import type { RefObject } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle } from "lucide-react";
import { GaIcon } from "@/components/ui-v2";
import { CURRENT_LEVEL_OPTIONS, TARGET_LEVEL_OPTIONS, journeyEstimate } from "../wizardModel";
import { cardCls, chipCls, headingCls, rowCls, subCls } from "./stepStyles";

/** Icon theo mức — mỗi mức một việc làm được, đọc lướt vẫn thấy tiến độ (không dùng chung icon sách). */
const LEVEL_ICON: Record<string, string> = {
  A0: "eco",
  A1: "menu_book",
  A2: "forum",
  B1: "record_voice_over",
  B2: "school",
};

interface Props {
  currentLevel: string;
  targetLevel: string;
  onChangeCurrent: (level: string) => void;
  onChangeTarget: (level: string) => void;
  headingRef: RefObject<HTMLHeadingElement>;
}

/** Bước 2 — "Bạn đang ở đâu, và muốn tới đâu?" A0 chọn sẵn tường minh (F-1) + thẻ hành trình. */
export function LevelStep({ currentLevel, targetLevel, onChangeCurrent, onChangeTarget, headingRef }: Props) {
  const t = useTranslations("v2.onboarding");
  const estimate = journeyEstimate(currentLevel, targetLevel);
  return (
    <div className={cardCls}>
      <h1 ref={headingRef} tabIndex={-1} className={headingCls}>{t("level.heading")}</h1>
      <p className={subCls}>{t("level.sub")}</p>

      <fieldset>
        <legend className="ga-ui mb-2 block text-ga-small font-semibold text-ga-ink">{t("level.currentLabel")}</legend>
        <div role="radiogroup" aria-label={t("level.currentLabel")} className="space-y-2">
          {CURRENT_LEVEL_OPTIONS.map((l) => (
            <button key={l} type="button" role="radio" aria-checked={currentLevel === l} onClick={() => onChangeCurrent(l)} className={rowCls(currentLevel === l)}>
              <GaIcon name={LEVEL_ICON[l]} size={22} className="text-ga-muted" />
              <div className="min-w-0 flex-1">
                <p className="ga-ui text-ga-small font-bold text-ga-ink">{t(`level.${l}.label`)}</p>
                <p className="text-ga-caption text-ga-muted">{t(`level.${l}.desc`)}</p>
              </div>
              {currentLevel === l && <CheckCircle size={18} className="text-ga-gold" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="ga-ui mb-2 block text-ga-small font-semibold text-ga-ink">{t("level.targetLabel")}</legend>
        <div role="radiogroup" aria-label={t("level.targetLabel")} className="flex flex-wrap gap-1.5">
          {TARGET_LEVEL_OPTIONS.map((l) => (
            <button key={l} type="button" role="radio" aria-checked={targetLevel === l} onClick={() => onChangeTarget(l)} className={chipCls(targetLevel === l)}>
              {l}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="rounded-ga border border-ga-line bg-ga-surface p-3 flex items-center gap-3" aria-live="polite">
        <span className="ga-ui text-ga-numeral text-ga-ink">{currentLevel}</span>
        <span className="flex-1 h-px bg-ga-line" aria-hidden="true" />
        <span className="ga-ui text-ga-numeral text-ga-gold">{targetLevel}</span>
      </div>
      <p className="text-ga-caption text-ga-muted">
        {estimate ? t("level.journey", { nodes: estimate.nodes, weeks: estimate.weeks }) : t("level.journeyGeneric")}
      </p>
    </div>
  );
}
