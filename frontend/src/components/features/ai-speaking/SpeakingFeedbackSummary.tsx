"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, Check, ChevronDown, ChevronUp, Circle } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  buildFeedbackDimensions,
  type FeedbackDimension,
  type FeedbackInput,
  type FeedbackLevel,
} from "@/lib/speaking/feedbackModel";

/**
 * Phản hồi summary-first của phiên luyện nói (S-07 AC-3 / B-16 lô 4).
 *
 * Mặc định mỗi chiều chỉ là **một dòng**: tên chiều · mức · tóm tắt. Bằng chứng (span sai → span
 * đúng, luật, bảng phoneme, câu gợi ý) nằm sau nút "xem bằng chứng". Bản cũ đổ thẳng danh sách lỗi
 * + danh sách gợi ý + bảng phoneme ra sidebar cùng lúc, nên lúc nào cũng phải cuộn để biết mình
 * vừa nói thế nào.
 *
 * **Mức không truyền chỉ bằng màu** (a11y của plan): mỗi mức có nhãn CHỮ và một icon hình khác
 * nhau, màu chỉ là lớp thứ ba.
 *
 * Bảng phoneme `dynamic import` theo yêu cầu §Performance của plan — nó chỉ xuất hiện khi lượt đó
 * thật sự được chấm phát âm, không đáng nằm trong bundle của mọi phiên.
 */
const SpeakingPhonemePanel = dynamic(
  () => import("./SpeakingPhonemePanel").then((m) => m.SpeakingPhonemePanel),
  { ssr: false },
);

const LEVEL_ICON = { good: Check, ok: Circle, attention: AlertTriangle } as const;

const LEVEL_CHIP: Record<FeedbackLevel, string> = {
  good: "bg-ga-green-soft text-ga-green border-ga-green",
  ok: "bg-ga-yellow-soft text-ga-gold border-ga-yellow",
  attention: "bg-ga-red-soft text-ga-red border-ga-red",
};

interface Props extends FeedbackInput {
  onSuggestionSelect: (text: string) => void;
  phonemeLoading?: boolean;
}

export function SpeakingFeedbackSummary({ onSuggestionSelect, phonemeLoading, ...input }: Props) {
  const t = useTranslations("speaking.chat");
  const dimensions = buildFeedbackDimensions(input);

  if (dimensions.length === 0) return null;

  return (
    <section aria-labelledby="speaking-feedback-title" className="space-y-2">
      <h2
        id="speaking-feedback-title"
        className="px-1 text-[10px] font-bold uppercase tracking-wide text-ga-subtle"
      >
        {t("feedbackTitle")}
      </h2>
      <ul className="space-y-1.5">
        {dimensions.map((dimension) => (
          <li key={dimension.id}>
            <DimensionRow
              dimension={dimension}
              phonemeLoading={phonemeLoading}
              onSuggestionSelect={onSuggestionSelect}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function DimensionRow({
  dimension,
  phonemeLoading,
  onSuggestionSelect,
}: {
  dimension: FeedbackDimension;
  phonemeLoading?: boolean;
  onSuggestionSelect: (text: string) => void;
}) {
  const t = useTranslations("speaking.chat");
  const [open, setOpen] = useState(false);

  const LevelIcon = LEVEL_ICON[dimension.level];
  const hasEvidence =
    !!dimension.phoneme ||
    (dimension.errors?.length ?? 0) > 0 ||
    (dimension.suggestions?.length ?? 0) > 0 ||
    !!dimension.note;
  const panelId = `speaking-feedback-${dimension.id}`;

  return (
    <div className="ga-ui overflow-hidden rounded-ga border border-ga-line bg-ga-surface">
      {/* Tên chiều + mức trên MỘT hàng, tóm tắt chiếm trọn bề ngang bên dưới. Bản đầu nhét cả ba
          (mức · tên+tóm tắt · nút mở) vào một hàng ngang, nên trong panel 340px của khổ xl dòng
          tóm tắt chỉ còn hơn trăm pixel và gãy thành ba dòng cụt. */}
      <div className="px-3 pt-2.5 pb-2">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-[13px] font-semibold text-ga-ink">
            {t(`dimension.${dimension.id}`)}
          </p>
          <span
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-ga-pill border px-1.5 py-0.5 text-[10px] font-bold",
              LEVEL_CHIP[dimension.level],
            )}
          >
            <LevelIcon size={11} aria-hidden />
            {t(`level.${dimension.level}`)}
          </span>
        </div>
        <p className="mt-0.5 text-[12px] leading-relaxed text-ga-muted">
          {t(dimension.summaryKey, dimension.summaryValues)}
        </p>
      </div>

      {hasEvidence && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-center justify-between gap-2 border-t border-ga-line px-3 py-2 text-[11px] font-semibold text-ga-accent transition-colors hover:bg-ga-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-inset"
        >
          {open ? t("hideEvidence") : t("showEvidence")}
          {open ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
        </button>
      )}

      {open && hasEvidence && (
        <div id={panelId} className="space-y-2 border-t border-ga-line bg-ga-card px-3 py-2.5">
          {dimension.phoneme && (
            <SpeakingPhonemePanel result={dimension.phoneme} loading={phonemeLoading} />
          )}

          {dimension.note && !dimension.phoneme && (
            <p className="text-[12px] leading-relaxed text-ga-muted">{dimension.note}</p>
          )}

          {dimension.errors?.map((err, idx) => (
            <div
              key={`${err.errorCode}-${idx}`}
              className="rounded-ga border border-ga-line bg-ga-card p-2.5 text-sm"
            >
              {err.wrongSpan && (
                <p className="mb-1 text-[13px] text-ga-red line-through">&quot;{err.wrongSpan}&quot;</p>
              )}
              {err.correctedSpan && (
                <p className="text-[13px] font-medium text-ga-green">
                  → &quot;{err.correctedSpan}&quot;
                </p>
              )}
              {err.ruleViShort && (
                <p className="mt-1 text-[12px] text-ga-muted">{err.ruleViShort}</p>
              )}
              {err.exampleCorrectDe && (
                <p className="mt-1 text-[12px] text-ga-subtle italic">
                  {t("fbExampleLabel")}: {err.exampleCorrectDe}
                </p>
              )}
            </div>
          ))}

          {dimension.suggestions?.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSuggestionSelect(s.german_text)}
              className="w-full rounded-ga border border-ga-line bg-ga-card p-2.5 text-left transition-colors hover:border-ga-accent hover:bg-ga-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-inset"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-medium leading-snug text-ga-ink">{s.german_text}</p>
                {s.level && (
                  <span className="shrink-0 rounded-ga bg-ga-yellow-soft px-1.5 py-0.5 text-[9px] font-bold text-ga-gold">
                    {s.level}
                  </span>
                )}
              </div>
              {s.vietnamese_translation && (
                <p className="mt-1 text-[12px] italic text-ga-muted">{s.vietnamese_translation}</p>
              )}
              {s.why_to_use && (
                <p className="mt-1 line-clamp-2 text-[11px] text-ga-subtle">{s.why_to_use}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
