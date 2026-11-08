'use client'

import { useTranslations } from 'next-intl'
import { GaCap } from '@/components/ui-v2'

/**
 * Bằng chứng xã hội (đợt B, kế hoạch cải thiện trang chủ 08/11/2026) — KHUNG ẨN. Owner chốt: chưa có
 * nhận xét thật thì không hiện, không bịa (sổ lời hứa). Bật khi đủ cả hai điều kiện:
 *   1. `SHOW_SOCIAL_PROOF = true`;
 *   2. catalog `v2.landing.socialProof.items` có ≥3 nhận xét thật (tên, nghề, trình độ, một câu kết
 *      quả — đã xin phép người đó) và `stats` có ≥1 con số đo được (kèm nguồn).
 * Thiếu một trong hai thì không render gì — không để lại khung trống.
 */
export const SHOW_SOCIAL_PROOF = false

export type Testimonial = { name: string; job: string; level: string; result: string }
export type ProofStat = { value: string; label: string }

export function SocialProof({ show = SHOW_SOCIAL_PROOF }: { show?: boolean }) {
  const t = useTranslations('v2.landing.socialProof')
  const items = (t.raw('items') as Testimonial[] | undefined) ?? []
  const stats = (t.raw('stats') as ProofStat[] | undefined) ?? []
  if (!show || items.length < 3 || stats.length < 1) return null

  return (
    <section id="nhan-xet" className="scroll-mt-[78px] border-t border-ga-border">
      <div className="mx-auto max-w-[1240px] px-5 py-14 sm:px-8 md:py-[78px] lg:px-[60px]">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-6">
          <div>
            <GaCap className="mb-[18px]">{t('cap')}</GaCap>
            <h2 className="font-ga-display text-ga-h1-m font-medium text-ga-ink lg:text-ga-display">{t('title')}</h2>
          </div>
          {stats.slice(0, 1).map((s) => (
            <div key={s.label} className="text-right">
              <div className="font-ga-display text-ga-stat text-ga-ink">{s.value}</div>
              <div className="text-ga-small text-ga-muted">{s.label}</div>
            </div>
          ))}
        </div>
        <ul className="grid gap-4 md:grid-cols-3">
          {items.slice(0, 3).map((it) => (
            <li key={it.name} className="flex flex-col gap-4 border border-ga-border bg-ga-card p-5 sm:p-6">
              <p className="font-ga-display text-ga-body-lg italic text-ga-ink">“{it.result}”</p>
              <p className="mt-auto text-ga-small text-ga-muted">
                <strong className="font-semibold text-ga-ink">{it.name}</strong> · {it.job} · {it.level}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
