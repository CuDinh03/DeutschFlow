import { toast } from "sonner";
import { httpStatus, apiMessage } from "@/lib/api";
import { formatQuotaExceededBody, type QuotaMessageVariant } from "@/lib/quotaReset";

export type ToastApiErrorOpts = {
  /** Shown for 5xx and network failures */
  onRetry?: () => void;
  /** @deprecated prefer locale + quotaVariant for 429 */
  quotaMessage?: string;
  genericMessage?: string;
  /** next-intl locale (vi | en | de) for quota copy */
  locale?: string;
  /** Default generic explains daily + monthly reset in Asia/Ho_Chi_Minh */
  quotaVariant?: QuotaMessageVariant;
};

/** Maps Axios-style errors to Sonner toasts (429 quota, 5xx + retry). */
export function toastApiError(err: unknown, opts: ToastApiErrorOpts = {}) {
  const status = httpStatus(err);
  const msg = apiMessage(err);

  if (status === 401 || status === 403) return;

  if (status === 429) {
    if (opts.quotaMessage) {
      toast.error(opts.quotaMessage, { duration: 8000 });
      return;
    }
    const loc = opts.locale ?? "en";
    const { title, detail } = formatQuotaExceededBody(loc, opts.quotaVariant ?? "generic");
    toast.error(title, {
      description: detail,
      duration: 10_000,
    });
    return;
  }

  if (status >= 500 || status === 0) {
    toast.error((opts.genericMessage ?? msg) || "Server error.", {
      duration: 8000,
      action: opts.onRetry
        ? {
            label: "Retry",
            onClick: () => opts.onRetry?.(),
          }
        : undefined,
    });
    return;
  }

  toast.error(msg || "Something went wrong.");
}
