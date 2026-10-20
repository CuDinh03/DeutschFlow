'use client'

import { useTranslations } from 'next-intl'
import { GaCap } from '@/components/ui-v2'
import { PERSONA_LIST } from '@/lib/personas'
import { PersonaPortrait, hasPortrait } from './PersonaPortrait'

/**
 * Dàn người phỏng vấn (làm mới hình ảnh trang chủ 19/10/2026): mỗi nhân vật phỏng vấn của app một
 * thẻ, cùng hình vẽ khách sẽ gặp trong phòng phỏng vấn. Điều dưỡng và Xây dựng ghi "Sắp có" theo
 * sổ lời hứa cho tới khi bộ câu hỏi riêng được duyệt (đợt 2f).
 */

type Soon = { name: string; de: string; note: string }

const CAST = PERSONA_LIST.filter((p) => p.supportsInterview && hasPortrait(p.id))

export function CastSection({ className = '' }: { className?: string }) {
  const t = useTranslations('v2.landing.cast')
  const soon = t.raw('soon') as Soon[]
  return (
    <section id="cast" className={`scroll-mt-[78px] border-y border-ga-border bg-ga-side-active ${className}`}>
      <div className="mx-auto max-w-[1240px] px-5 py-14 sm:px-8 md:py-[78px] lg:px-[60px]">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-[640px]">
            <GaCap className="mb-[18px]">{t('cap')}</GaCap>
            <h2 className="font-ga-display text-ga-h1-m font-medium tracking-[-0.015em] text-ga-ink lg:text-ga-display">{t('title')}</h2>
          </div>
          <p className="max-w-[400px] text-ga-body text-ga-muted">{t('sub')}</p>
        </div>
        <ul className="grid grid-cols-3 gap-2 sm:gap-4 lg:grid-cols-5">
          {CAST.map((p) => (
            <li key={p.id} className="border border-ga-border bg-ga-card">
              <PersonaPortrait id={p.id} />
              <div className="px-2 pb-2.5 pt-2 sm:px-3 sm:pb-3.5 sm:pt-3">
                <div className="truncate text-ga-small font-semibold text-ga-ink sm:text-ga-body">{p.name}</div>
                <div lang="de" className="mt-0.5 truncate text-ga-caption text-ga-muted sm:text-ga-small">{p.role}</div>
                <div className="mt-1.5 hidden truncate text-ga-caption text-ga-subtle sm:block">{p.tag}</div>
              </div>
            </li>
          ))}
        </ul>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
          {soon.map((s) => (
            <li key={s.de} className="flex items-center gap-4 border border-dashed border-ga-subtle bg-ga-bg px-5 py-4">
              <span className="shrink-0 bg-ga-ink px-2 py-1 text-ga-eyebrow uppercase text-ga-yellow">{t('soonCap')}</span>
              <span className="text-ga-small text-ga-ink">
                <strong className="font-semibold">{s.name}</strong>
                {s.de !== s.name && <span lang="de" className="text-ga-muted"> · {s.de}</span>}
                <span className="block text-ga-caption text-ga-muted">{s.note}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
