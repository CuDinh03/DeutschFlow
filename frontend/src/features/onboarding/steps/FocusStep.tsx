"use client";

import type { ReactNode, RefObject } from "react";
import { useTranslations } from "next-intl";
import { EXAMS, INDUSTRIES, type GoalType } from "../wizardModel";
import { cardCls, chipCls, headingCls, rowCls, subCls } from "./stepStyles";

interface Props {
  goalType: GoalType;
  industry: string | null;
  examType: string | null;
  onChangeIndustry: (industry: string | null) => void;
  onChangeExam: (exam: string | null) => void;
  /** Thẻ mentor reveal do trang cha dựng (cần preview API + upsell theo gói). */
  mentorCard?: ReactNode;
  headingRef: RefObject<HTMLHeadingElement>;
}

/**
 * Bước 4 — lĩnh vực (WORK) hoặc kỳ thi (CERT), KHÔNG bắt buộc như mobile: bấm lại để bỏ chọn.
 * Mentor reveal nằm ở cuối bước — đỉnh cảm xúc của phễu.
 */
export function FocusStep({ goalType, industry, examType, onChangeIndustry, onChangeExam, mentorCard, headingRef }: Props) {
  const t = useTranslations("v2.onboarding");
  const isWork = goalType === "WORK";
  return (
    <fieldset className={cardCls}>
      {/* legend chứa chính h1: đầu đọc màn hình đọc một lần, không lặp (legend cho phép heading content). */}
      <legend className="contents"><h1 ref={headingRef} tabIndex={-1} className={headingCls}>{isWork ? t("focus.industryHeading") : t("focus.examHeading")}</h1></legend>
      <p className={subCls}>{isWork ? t("focus.industrySub") : t("focus.examSub")}</p>
      {isWork ? (
        <div role="radiogroup" aria-label={t("focus.industryHeading")} className="flex flex-wrap gap-1.5">
          {INDUSTRIES.map((ind) => (
            <button key={ind} type="button" role="radio" aria-checked={industry === ind} onClick={() => onChangeIndustry(industry === ind ? null : ind)} className={chipCls(industry === ind)}>
              {t(`focus.industry.${ind}`)}
            </button>
          ))}
        </div>
      ) : (
        <div role="radiogroup" aria-label={t("focus.examHeading")} className="space-y-2">
          {EXAMS.map((ex) => (
            <button key={ex} type="button" role="radio" aria-checked={examType === ex} onClick={() => onChangeExam(examType === ex ? null : ex)} className={rowCls(examType === ex)}>
              <div className="min-w-0 flex-1">
                <p className="ga-ui text-ga-small font-bold text-ga-ink">{t(`focus.exam.${ex}.label`)}</p>
                <p className="text-ga-caption text-ga-muted">{t(`focus.exam.${ex}.desc`)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {mentorCard}
    </fieldset>
  );
}
