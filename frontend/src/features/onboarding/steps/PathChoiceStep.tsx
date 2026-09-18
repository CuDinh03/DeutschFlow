"use client";

import { useState, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, CheckCircle } from "lucide-react";
import { GaBtn, GaIcon } from "@/components/ui-v2";
import type { PathChoice } from "../machine";
import { cardCls, headingCls, rowCls, subCls } from "./stepStyles";

/**
 * W5b — Chọn đường (trạng thái `PATH_CHOICE`, Đợt 4 PR-2 19/09/2026), chỉ A1+.
 *
 * Ba lựa chọn: kiểm tra nhanh 10 câu (placement, trong trang) · nói thử 3′ với mentor
 * (`/v2/onboarding/mock-exam` — cửa vào DUY NHẤT của hai trang mồ côi mock-exam/error-report, W-4)
 * · bỏ qua. Thuần trình bày, KHÔNG biết khách hay đã đăng nhập: khách chọn trước tài khoản (I-9),
 * người đăng ký thẳng được hỏi sau khi có plan (fixture R5). Cùng hình với mobile `PathChoiceCard`.
 */
const OPTIONS: { value: PathChoice; icon: string }[] = [
  { value: "placement", icon: "target" },
  { value: "mock_exam", icon: "record_voice_over" },
  { value: "skip", icon: "arrow_forward" },
];

const LABEL_KEY: Record<PathChoice, string> = { placement: "placement", mock_exam: "mockExam", skip: "skip" };

interface Props {
  level: string;
  onPick: (choice: PathChoice) => void;
  loading?: boolean;
  headingRef: RefObject<HTMLHeadingElement>;
}

export function PathChoiceStep({ level, onPick, loading = false, headingRef }: Props) {
  const t = useTranslations("v2.onboarding");
  const [choice, setChoice] = useState<PathChoice | null>(null);
  return (
    <div className={cardCls} data-testid="path-choice">
      <p className="ga-ui text-ga-eyebrow uppercase text-ga-muted">{t("pathChoice.cap", { level })}</p>
      <h1 ref={headingRef} tabIndex={-1} className={headingCls}>{t("pathChoice.heading")}</h1>
      <p className={subCls}>{t.rich("pathChoice.body", { level, b: (chunks) => <strong>{chunks}</strong> })}</p>
      <div role="radiogroup" aria-label={t("pathChoice.heading")} className="space-y-2">
        {OPTIONS.map((opt) => {
          const selected = choice === opt.value;
          const k = LABEL_KEY[opt.value];
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={loading}
              onClick={() => setChoice(opt.value)}
              className={rowCls(selected)}
            >
              <GaIcon name={opt.icon} size={22} className={selected ? "text-ga-ink" : "text-ga-muted"} />
              <div className="min-w-0 flex-1">
                <p className="ga-ui text-ga-small font-bold text-ga-ink">{t(`pathChoice.${k}`)}</p>
                <p className="text-ga-caption text-ga-muted">{t(`pathChoice.${k}Desc`)}</p>
              </div>
              {selected && <CheckCircle size={18} className="text-ga-gold" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <GaBtn
        variant="ink"
        size="lg"
        className="w-full"
        loading={loading}
        disabled={loading || !choice}
        onClick={() => { if (choice) onPick(choice); }}
      >
        {t("pathChoice.continue")} <ArrowRight size={14} />
      </GaBtn>
      <p className="text-ga-caption text-ga-muted">{t("pathChoice.note")}</p>
    </div>
  );
}
