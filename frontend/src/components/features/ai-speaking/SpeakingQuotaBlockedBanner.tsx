"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  compact?: boolean;
  /**
   * Upgrade surface the CTA points at. Injected because this banner is rendered from BOTH the
   * legacy speaking pages and the /v2 (Galerie) ones — a hardcoded v1 path would deep-link /v2
   * users back into the shell that is being deleted.
   * Default is the v1 pricing page: the old target `/student/my-plan` does not exist (404).
   */
  upgradeHref?: string;
}

export function SpeakingQuotaBlockedBanner({
  className,
  compact,
  upgradeHref = "/student/pricing",
}: Props) {
  const t = useTranslations("speaking");

  return (
    <div
      className={cn(
        "ga-ui rounded-ga border border-ga-yellow bg-ga-yellow-soft px-4 py-3",
        compact ? "text-left" : "text-center",
        className,
      )}
      role="alert"
    >
      <div className={cn("flex gap-3", compact ? "items-start" : "flex-col items-center")}>
        <AlertCircle
          className={cn("text-ga-gold flex-shrink-0", compact ? "mt-0.5" : "mx-auto")}
          size={compact ? 20 : 28}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold text-ga-ink">{t("quotaBlockedTitle")}</p>
          <p className="text-xs text-ga-muted leading-relaxed">{t("quotaBlockedDesc")}</p>
          <Link
            href={upgradeHref}
            className="inline-block mt-2 text-xs font-semibold text-ga-gold hover:text-ga-ink underline-offset-2 hover:underline"
          >
            {t("quotaBlockedCta")}
          </Link>
        </div>
      </div>
    </div>
  );
}
