"use client";

import { useEffect, useId, useMemo, useState, type ReactNode, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { occupationApi } from "@/lib/occupationApi";
import { occupationName, searchOccupations, type OccupationSummary } from "@/lib/occupationTypes";
import { EXAMS, INDUSTRIES, type GoalType } from "../wizardModel";
import { cardCls, chipCls, headingCls, rowCls, subCls } from "./stepStyles";

interface Props {
  goalType: GoalType;
  industry: string | null;
  examType: string | null;
  occupationCode: string | null;
  targetDate: string | null;
  locale: string;
  onChangeIndustry: (industry: string | null) => void;
  onChangeExam: (exam: string | null) => void;
  /** Đợt 2e: chọn/bỏ nghề trong danh mục công khai — trang cha suy `industry` từ nhóm nơi làm việc. */
  onChangeOccupation: (occupation: OccupationSummary | null) => void;
  onChangeTargetDate: (date: string | null) => void;
  /** Thẻ mentor reveal do trang cha dựng (cần preview API + upsell theo gói). */
  mentorCard?: ReactNode;
  headingRef: RefObject<HTMLHeadingElement>;
}

const MAX_SUGGESTIONS = 6;
const inputCls =
  "block min-h-11 w-full rounded-ga border border-ga-line bg-ga-bg px-4 py-3 text-ga-body text-ga-ink outline-none focus-visible:ring-2 focus-visible:ring-ga-focus";

/** Tháng hiện tại dạng `yyyy-MM` — ngày mốc không chọn được tháng đã qua. */
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Bước 4 — nghề (WORK) hoặc kỳ thi (CERT), KHÔNG bắt buộc như mobile: bấm lại để bỏ chọn.
 * Đợt 2e: WORK hỏi nghề trong danh mục công khai (~150 nghề); danh mục chưa tải được thì giữ sáu ngành
 * cũ. Cả hai nhánh hỏi thêm ngày mốc theo tháng. Mentor reveal nằm ở cuối bước — đỉnh cảm xúc của phễu.
 */
export function FocusStep({
  goalType, industry, examType, occupationCode, targetDate, locale,
  onChangeIndustry, onChangeExam, onChangeOccupation, onChangeTargetDate, mentorCard, headingRef,
}: Props) {
  const t = useTranslations("v2.onboarding");
  const isWork = goalType === "WORK";
  const inputId = useId();
  const dateId = useId();
  const [catalog, setCatalog] = useState<OccupationSummary[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!isWork) return;
    let alive = true;
    Promise.resolve()
      .then(() => occupationApi.list())
      .then((list) => { if (alive && Array.isArray(list) && list.length) setCatalog(list); })
      .catch(() => { /* giữ sáu ngành dự phòng */ });
    return () => { alive = false; };
  }, [isWork]);

  const selected = catalog?.find((o) => o.code === occupationCode) ?? null;
  const suggestions = useMemo(
    () => (catalog ? searchOccupations(catalog, query, MAX_SUGGESTIONS) : []),
    [catalog, query],
  );

  return (
    <fieldset className={cardCls}>
      {/* legend chứa chính h1: đầu đọc màn hình đọc một lần, không lặp (legend cho phép heading content). */}
      <legend className="contents"><h1 ref={headingRef} tabIndex={-1} className={headingCls}>{isWork ? t("focus.industryHeading") : t("focus.examHeading")}</h1></legend>
      <p className={subCls}>{isWork ? t("focus.industrySub") : t("focus.examSub")}</p>
      {isWork && catalog ? (
        <div className="space-y-2">
          {selected ? (
            <div className="flex items-center justify-between gap-3 rounded-ga border border-ga-ink bg-ga-yellow-soft px-4 py-3">
              <div className="min-w-0">
                <p className="ga-ui text-ga-small font-bold text-ga-ink" lang="de">{selected.nameDe}</p>
                {locale !== "de" && <p className="text-ga-caption text-ga-muted">{occupationName(selected, locale)}</p>}
                <p className="mt-1 text-ga-caption text-ga-muted">{t("focus.occupationHint")}</p>
              </div>
              <button type="button" onClick={() => { onChangeOccupation(null); setQuery(""); }} className="shrink-0 text-ga-small font-semibold text-ga-ink underline">
                {t("focus.occupationChange")}
              </button>
            </div>
          ) : (
            <>
              <label htmlFor={inputId} className="block text-ga-small font-semibold text-ga-ink">{t("focus.occupationLabel")}</label>
              <input
                id={inputId}
                type="search"
                autoComplete="off"
                value={query}
                placeholder={t("focus.occupationPlaceholder")}
                onChange={(e) => setQuery(e.target.value)}
                className={inputCls}
              />
              {suggestions.length > 0 && (
                <div role="radiogroup" aria-label={t("focus.occupationLabel")} className="space-y-1.5">
                  {suggestions.map((o) => (
                    <button key={o.code} type="button" role="radio" aria-checked={false} onClick={() => onChangeOccupation(o)} className={rowCls(false)}>
                      <div className="min-w-0 flex-1 text-left">
                        <p className="ga-ui text-ga-small font-bold text-ga-ink" lang="de">{o.nameDe}</p>
                        {locale !== "de" && <p className="text-ga-caption text-ga-muted">{occupationName(o, locale)}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {query.trim() && suggestions.length === 0 && (
                <p className="text-ga-caption text-ga-muted">{t("focus.occupationNoMatch", { query: query.trim() })}</p>
              )}
            </>
          )}
        </div>
      ) : isWork ? (
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

      <div className="space-y-1.5 pt-2">
        <label htmlFor={dateId} className="block text-ga-small font-semibold text-ga-ink">{t("focus.targetDateLabel")}</label>
        <p className="text-ga-caption text-ga-muted">{t("focus.targetDateHint")}</p>
        <div className="flex items-center gap-3">
          <input
            id={dateId}
            type="month"
            min={currentMonth()}
            value={targetDate ? targetDate.slice(0, 7) : ""}
            onChange={(e) => onChangeTargetDate(e.target.value ? `${e.target.value}-01` : null)}
            className={`${inputCls} max-w-[220px]`}
          />
          {targetDate && (
            <button type="button" onClick={() => onChangeTargetDate(null)} className="text-ga-small font-semibold text-ga-ink underline">
              {t("focus.targetDateClear")}
            </button>
          )}
        </div>
      </div>
      {mentorCard}
    </fieldset>
  );
}
