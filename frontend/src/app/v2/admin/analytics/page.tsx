'use client'

import { useTranslations } from 'next-intl'
import { GaPageHdr } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Product Analytics (admin) — navy (W1.7 migrate admin/analytics).
// Parity: nhúng PostHog Shared Dashboard qua NEXT_PUBLIC_POSTHOG_SHARED_DASHBOARD_URL
// (CSP next.config cho phép `frame-src https:`). Chưa cấu hình → hiện hướng dẫn.
// ─────────────────────────────────────────────────────────────────────────────

const DASHBOARD_URL = process.env.NEXT_PUBLIC_POSTHOG_SHARED_DASHBOARD_URL

export default function V2AdminAnalyticsPage() {
  const t = useTranslations('v2.adminOps.analytics')
  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-10">
        <div className="relative h-[560px] w-full overflow-hidden border border-ga-line bg-ga-card lg:h-[780px]">
          {DASHBOARD_URL ? (
            <iframe src={DASHBOARD_URL} title={t('dashboardTitle')} className="absolute inset-0 h-full w-full" style={{ border: 0 }} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-4 text-center lg:px-6">
              <h2 className="font-ga-display text-[22px] font-medium text-ga-ink">{t('notConfiguredTitle')}</h2>
              <p className="ga-ui mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-ga-muted">
                {t('notConfiguredPre')}<code className="break-words font-mono text-[12px] text-ga-accent">NEXT_PUBLIC_POSTHOG_SHARED_DASHBOARD_URL</code>{t('notConfiguredPost')}
              </p>
              <a
                href="https://posthog.com/docs/dashboards/sharing"
                target="_blank"
                rel="noreferrer"
                className="ga-ui mt-5 inline-flex items-center gap-1.5 border border-ga-line px-4 py-2 text-[13px] font-semibold text-ga-ink transition-colors hover:border-ga-accent hover:text-ga-accent"
              >
                {t('postHogGuide')}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
