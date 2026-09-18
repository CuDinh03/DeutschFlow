"use client";

import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { GaIcon } from "@/components/ui-v2";

/**
 * W7 — "Đang tạo lộ trình…" (trạng thái `CREATING`, Đợt 4 PR-2 19/09/2026). Ba dòng như mobile
 * (`Resuming` trong `mobile/app/(auth)/onboarding.tsx`): hai dòng đã xong hiện dần, dòng cuối quay.
 * Hiện cho MỌI đường tới hồ sơ (I-10): replay draft, claim, và người đăng ký thẳng bấm lưu.
 * Không mentor/monogram ở đây — instance thắng cuộc đua replay có thể là instance mới với state
 * mặc định, thà trung tính còn hơn sai tên.
 */
export function CreatingPanel() {
  const t = useTranslations("v2.onboarding");
  const stages = [
    { key: "stage1", done: true },
    { key: "stage2", done: true },
    { key: "stage3", done: false },
  ] as const;
  return (
    <div className="space-y-4 text-center" role="status" data-testid="creating-panel">
      <Loader2 size={28} className="mx-auto animate-spin text-ga-gold" aria-hidden="true" />
      <div>
        <p className="ga-ui text-ga-body font-semibold text-ga-ink">{t("creating.title")}</p>
        <p className="mt-1 text-ga-small text-ga-muted">{t("creating.sub")}</p>
      </div>
      <ul className="rounded-ga border border-ga-line bg-ga-card text-left">
        {stages.map((s, i) => (
          <li
            key={s.key}
            className={`flex items-center gap-3 px-4 py-3 ${i < stages.length - 1 ? "border-b border-ga-line" : ""}`}
          >
            {s.done ? (
              <span
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-ga-pill bg-ga-green text-ga-card"
                aria-hidden="true"
              >
                <GaIcon name="check" size={12} />
              </span>
            ) : (
              <Loader2 size={18} className="shrink-0 animate-spin text-ga-gold" aria-hidden="true" />
            )}
            <span className="ga-ui text-ga-small font-semibold text-ga-ink">{t(`creating.${s.key}`)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
