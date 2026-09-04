"use client";

import { Clock, Target } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Dải ngữ cảnh của Studio — vùng TRÁI của bố cục 3 vùng ở ≥1280 (S-07 §Responsive / B-16 lô 4).
 *
 * Trước lô này bố cục chỉ có hai cột: transcript 65% + sidebar 35%, tức vẫn là màn hình chat có
 * panel phụ. Plan đòi ba vùng — **ngữ cảnh trái · ghi âm + transcript giữa · phản hồi phải** — để
 * thứ người học cần giữ trong đầu suốt phiên (mình đang đóng vai gì, mục tiêu là gì, trình độ nào)
 * không phải nằm nhồi trong một dòng subtitle bị cắt cụt trên header.
 *
 * Chỉ hiện từ `xl` trở lên. Dưới ngưỡng đó header vẫn giữ nguyên vai trò cũ, nên các trường ở đây
 * được header đánh dấu `xl:hidden` để không nói hai lần cùng một thứ.
 */
interface Props {
  modeLabel: string;
  companionName: string;
  personaRole?: string;
  cefrLevel?: string;
  sessionTopic?: string | null;
  secondsLabel: string;
}

export function SpeakingContextRail({
  modeLabel,
  companionName,
  personaRole,
  cefrLevel,
  sessionTopic,
  secondsLabel,
}: Props) {
  const t = useTranslations("speaking.chat");

  return (
    <aside
      aria-label={t("contextTitle")}
      className="ga-ui hidden xl:flex xl:w-[260px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-ga-line bg-ga-card p-4"
    >
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-ga-subtle">
          {t("contextTitle")}
        </p>
        <p className="mt-1.5 font-ga-display text-base font-medium leading-tight text-ga-ink">
          {companionName}
        </p>
        {personaRole && <p className="mt-0.5 text-[12px] italic text-ga-muted">{personaRole}</p>}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-ga-pill border border-ga-line bg-ga-surface px-2 py-0.5 text-[11px] font-semibold text-ga-ink">
          {modeLabel}
        </span>
        {cefrLevel && (
          <span
            title={t("contextLevel")}
            className="rounded-ga-pill border border-ga-blue bg-ga-blue-soft px-2 py-0.5 text-[11px] font-semibold text-ga-blue"
          >
            {cefrLevel}
          </span>
        )}
      </div>

      <div className="rounded-ga border border-ga-line bg-ga-surface p-3">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-ga-subtle">
          <Target size={11} aria-hidden />
          {t("contextGoal")}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-ga-ink">
          {sessionTopic || t("contextNoGoal")}
        </p>
      </div>

      <div className="mt-auto flex items-center gap-1.5 text-[11px] text-ga-muted">
        <Clock size={12} aria-hidden />
        <span>{t("contextElapsed")}</span>
        <span className="font-mono tabular-nums text-ga-ink">{secondsLabel}</span>
      </div>
    </aside>
  );
}
