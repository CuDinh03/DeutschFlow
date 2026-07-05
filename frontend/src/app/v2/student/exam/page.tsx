'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, Mic, ListChecks, Headphones, PenLine } from 'lucide-react'
import { GaPageHdr, GaCard, GaCap } from '@/components/ui-v2'

// Static exam-info hub (no backend) — mirrors legacy /luyen-thi. CTAs route into the
// real practice surfaces (mock-exam, speaking).
// `name` fields are Goethe exam proper nouns (identical in every locale) → not translated;
// only the human-readable descriptions/skill labels are externalized.

const LEVELS = [
  { code: 'A1', name: 'Goethe A1 · Start Deutsch 1', descKey: 'levels.a1Desc', color: '#1E9E61' },
  { code: 'A2', name: 'Goethe A2 · Start Deutsch 2', descKey: 'levels.a2Desc', color: '#2F6FC9' },
  { code: 'B1', name: 'Goethe B1 · Zertifikat', descKey: 'levels.b1Desc', color: '#7C56C8' },
  { code: 'B2', name: 'Goethe B2 · Zertifikat', descKey: 'levels.b2Desc', color: '#E07B39' },
]

// `speaking` flags the Sprechen card → routes to the speaking surface (others → mock-exam).
const SKILLS = [
  { icon: Headphones, labelKey: 'skills.listening', speaking: false },
  { icon: PenLine, labelKey: 'skills.reading', speaking: false },
  { icon: Mic, labelKey: 'skills.speaking', speaking: true },
  { icon: ListChecks, labelKey: 'skills.mock', speaking: false },
]

export default function V2StudentExamPage() {
  const t = useTranslations('v2.student.exam')
  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
      />
      <div className="flex-1 px-10 py-6">
        {/* Hero CTA */}
        <div className="mb-[22px] flex flex-col items-start gap-4 bg-ga-ink p-7 text-ga-bg md:flex-row md:items-center md:justify-between">
          <div>
            <GaCap className="mb-2 block" style={{ color: '#A39E94' }}>{t('heroCap')}</GaCap>
            <p className="font-ga-display text-[24px] font-medium">{t('heroTitle')}</p>
            <p className="ga-ui mt-1.5 text-[14px]" style={{ color: '#A39E94' }}>
              {t('heroDesc')}
            </p>
          </div>
          <Link
            href="/v2/student/mock-exam"
            className="ga-ui inline-flex shrink-0 items-center gap-2 bg-ga-yellow px-5 py-3 text-[14px] font-semibold text-ga-ink"
          >
            {t('heroCta')} <ArrowRight size={16} aria-hidden />
          </Link>
        </div>

        {/* Levels */}
        <GaCap className="mb-3 block">{t('levelsCap')}</GaCap>
        <div className="mb-[22px] grid grid-cols-1 gap-[18px] sm:grid-cols-2">
          {LEVELS.map((l) => (
            <GaCard key={l.code} hover className="flex items-start gap-4 p-5">
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-ga font-ga-display text-[18px] font-medium text-white"
                style={{ background: l.color }}
              >
                {l.code}
              </span>
              <div>
                <p className="text-[15px] font-semibold text-ga-ink">{l.name}</p>
                <p className="ga-ui mt-1 text-[13px] text-ga-muted">{t(l.descKey)}</p>
              </div>
            </GaCard>
          ))}
        </div>

        {/* Skills practice */}
        <GaCap className="mb-3 block">{t('skillsCap')}</GaCap>
        <div className="grid grid-cols-2 gap-[18px] lg:grid-cols-4">
          {SKILLS.map((s) => {
            const Icon = s.icon
            const href = s.speaking ? '/v2/student/speaking' : '/v2/student/mock-exam'
            return (
              <Link key={s.labelKey} href={href}>
                <GaCard hover className="group flex h-full flex-col items-start gap-3 p-5">
                  <span className="grid h-11 w-11 place-items-center rounded-ga bg-ga-accent-soft text-ga-accent">
                    <Icon size={22} aria-hidden />
                  </span>
                  <p className="text-[14px] font-semibold text-ga-ink">{t(s.labelKey)}</p>
                  <ArrowRight size={15} className="mt-auto text-ga-subtle transition-colors group-hover:text-ga-accent" aria-hidden />
                </GaCard>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
