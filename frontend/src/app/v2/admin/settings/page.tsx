'use client'

import { useTranslations } from 'next-intl'
import { GaPageHdr, GaCap } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Cấu hình hệ thống (admin) — navy, read-only overview (W1.7 migrate admin/settings).
// Parity: màn legacy là các thẻ tĩnh giới thiệu nhóm cấu hình (không có backend);
// giữ nguyên tính chất "tổng quan", chỉnh chi tiết qua từng module tương ứng.
// ─────────────────────────────────────────────────────────────────────────────

// Static section groups — labels/descriptions resolved via t('sections.<key>.…').
const SECTIONS: { key: 'platform' | 'security' | 'integrations'; items: string[] }[] = [
  { key: 'platform', items: ['branding', 'timezone', 'defaultLang', 'registration'] },
  { key: 'security', items: ['password', 'twoFa', 'roles', 'session'] },
  { key: 'integrations', items: ['payment', 'storage', 'ai', 'webhook'] },
]

export default function V2AdminSettingsPage() {
  const t = useTranslations('v2.adminOps.settings')
  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-10">
        <div className="grid gap-4 lg:grid-cols-3">
          {SECTIONS.map((s) => (
            <section key={s.key} className="min-w-0 border border-ga-line bg-ga-card p-4 lg:p-5">
              <h2 className="font-ga-display text-[18px] font-medium text-ga-ink">{t(`sections.${s.key}.title`)}</h2>
              <p className="ga-ui mt-2 text-[13px] leading-relaxed text-ga-muted">{t(`sections.${s.key}.desc`)}</p>
              <ul className="mt-4 flex flex-col gap-2">
                {s.items.map((it) => (
                  <li key={it} className="flex min-w-0 items-center gap-2 text-[13.5px] text-ga-ink">
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-ga-accent" /> {t(`sections.${s.key}.items.${it}`)}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <GaCap className="mt-6 block">{t('footer')}</GaCap>
      </div>
    </div>
  )
}
