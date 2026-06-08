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
      className="flex items-center gap-3 border-b border-amber-400/20 bg-amber-500/10 px-4 py-2.5"
    >
      <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-300" aria-hidden="true" />

      <div className="min-w-0 flex-1 text-left">
        <p className="text-[13px] leading-snug text-amber-100/90">{message}</p>
        <p className="mt-0.5 text-[11px] text-white/45">{t("micTypeInstead")}</p>
      </div>

      {retryable && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-400/25"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {t("micRetry")}
        </button>
      )}

      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("dismissError")}
        className="flex-shrink-0 rounded-full p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
