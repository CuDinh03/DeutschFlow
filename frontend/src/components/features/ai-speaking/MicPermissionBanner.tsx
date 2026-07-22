"use client";

import { AlertCircle, RefreshCw, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { isMicErrorRetryable, type MicErrorKind } from "@/lib/micErrors";

interface Props {
  /** Localised, already-resolved cause message. */
  message: string;
  /** Classified failure kind — decides whether retry is offered. */
  kind: MicErrorKind;
  onRetry: () => void;
  onDismiss: () => void;
}

/**
 * Actionable banner for microphone capture failures.
 *
 * Unlike the plain status line, this distinguishes the cause (denied / no
 * device / busy / insecure / unsupported), reassures the learner that typing
 * still works, and offers a retry where one can plausibly help.
 */
export function MicPermissionBanner({ message, kind, onRetry, onDismiss }: Props) {
  const t = useTranslations("speaking");
  const retryable = isMicErrorRetryable(kind);

  return (
    <div
      role="alert"
      className="ga-ui flex items-center gap-3 border-b border-ga-yellow bg-ga-yellow-soft px-4 py-2.5"
    >
      <AlertCircle className="h-4 w-4 flex-shrink-0 text-ga-gold" aria-hidden="true" />

      <div className="min-w-0 flex-1 text-left">
        <p className="text-[13px] leading-snug text-ga-ink">{message}</p>
        <p className="mt-0.5 text-[11px] text-ga-muted">{t("micTypeInstead")}</p>
      </div>

      {retryable && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-ga-pill border border-ga-yellow bg-ga-card px-3 py-1.5 text-xs font-semibold text-ga-gold transition-colors hover:bg-ga-yellow hover:text-ga-ink"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {t("micRetry")}
        </button>
      )}

      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("dismissError")}
        className="flex-shrink-0 rounded-full p-1.5 text-ga-muted transition-colors hover:bg-ga-side-active hover:text-ga-ink"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
