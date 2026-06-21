'use client'

import { GaPageHdr } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Product Analytics (admin) — navy (W1.7 migrate admin/analytics).
// Parity: nhúng PostHog Shared Dashboard qua NEXT_PUBLIC_POSTHOG_SHARED_DASHBOARD_URL
// (CSP next.config cho phép `frame-src https:`). Chưa cấu hình → hiện hướng dẫn.
// ─────────────────────────────────────────────────────────────────────────────

const DASHBOARD_URL = process.env.NEXT_PUBLIC_POSTHOG_SHARED_DASHBOARD_URL

export default function V2AdminAnalyticsPage() {
  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title="Product Analytics" subtitle="Hành vi người dùng, tỷ lệ chuyển đổi & hiệu suất hệ thống (PostHog)" />

      <div className="flex-1 overflow-auto px-10 py-6">
        <div className="relative h-[780px] w-full overflow-hidden border border-ga-line bg-ga-card">
          {DASHBOARD_URL ? (
            <iframe src={DASHBOARD_URL} title="Product Analytics Dashboard" className="absolute inset-0 h-full w-full" style={{ border: 0 }} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <h2 className="font-ga-display text-[22px] font-medium text-ga-ink">Chưa cấu hình Dashboard</h2>
              <p className="ga-ui mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-ga-muted">
                Đặt biến môi trường <code className="font-mono text-[12px] text-ga-accent">NEXT_PUBLIC_POSTHOG_SHARED_DASHBOARD_URL</code> (link Shared Dashboard từ PostHog) để hiển thị biểu đồ tại đây.
              </p>
              <a
                href="https://posthog.com/docs/dashboards/sharing"
                target="_blank"
                rel="noreferrer"
                className="ga-ui mt-5 inline-flex items-center gap-1.5 border border-ga-line px-4 py-2 text-[13px] font-semibold text-ga-ink transition-colors hover:border-ga-accent hover:text-ga-accent"
              >
                Hướng dẫn PostHog
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
