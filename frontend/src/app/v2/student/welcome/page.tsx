'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Mic, BookOpen, Repeat, Route, Trophy, ArrowRight, Sparkles } from 'lucide-react'
import { GaPageHdr, GaCard, GaCap } from '@/components/ui-v2'

// Welcome / help tour (client-side, no backend) — quick orientation to the daily surfaces.
// The first card is the ONLY permanent entry into /v2/student/beginner (the dashboard CTA only
// shows while sessionsCompleted === 0), so a returning student can still replay day 1.

const STEPS = [
  { icon: Sparkles, titleKey: 'steps.beginnerTitle', descKey: 'steps.beginnerDesc', href: '/v2/student/beginner', tone: 'var(--ga-gold)' },
  { icon: Route, titleKey: 'steps.roadmapTitle', descKey: 'steps.roadmapDesc', href: '/v2/student/roadmap', tone: 'var(--ga-teal)' },
  { icon: BookOpen, titleKey: 'steps.vocabTitle', descKey: 'steps.vocabDesc', href: '/v2/student/vocabulary', tone: 'var(--ga-blue)' },
  { icon: Mic, titleKey: 'steps.speakingTitle', descKey: 'steps.speakingDesc', href: '/v2/student/speaking', tone: 'var(--ga-violet)' },
  { icon: Repeat, titleKey: 'steps.reviewTitle', descKey: 'steps.reviewDesc', href: '/v2/student/review', tone: 'var(--ga-orange)' },
  { icon: Trophy, titleKey: 'steps.achievementsTitle', descKey: 'steps.achievementsDesc', href: '/v2/student/achievements', tone: 'var(--ga-gold)' },
]

export default function V2StudentWelcomePage() {
  const t = useTranslations('v2.student.welcome')
  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        <div className="mb-[22px] bg-ga-ink p-5 text-ga-bg lg:p-7">
          <GaCap className="mb-2 block" style={{ color: '#A39E94' }}>{t('heroCap')}</GaCap>
          <p className="font-ga-display text-[20px] font-medium lg:text-[26px]">{t('heroTitle')}</p>
          <p className="ga-ui mt-2 max-w-xl text-[14.5px]" style={{ color: '#A39E94' }}>
            {t('heroDesc')}
          </p>
          <Link
            href="/v2/student/dashboard"
            className="ga-ui mt-5 inline-flex items-center gap-2 bg-ga-yellow px-5 py-3 text-[14px] font-semibold text-ga-ink"
          >
            {t('heroCta')} <ArrowRight size={16} aria-hidden />
          </Link>
        </div>

        <GaCap className="mb-3 block">{t('featuresCap')}</GaCap>
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            return (
              <Link key={s.titleKey} href={s.href}>
                <GaCard hover className="group h-full p-5">
                  <div className="flex items-center gap-3">
                    {/* `${s.tone}1a` KHÔNG hợp lệ khi tone là `var(--ga-…)` → CSS bị bỏ qua, chip mất nền.
                        color-mix giữ đúng ý đồ (tint 10%) và chạy với cả biến CSS lẫn hex. */}
                    <span
                      className="grid h-10 w-10 place-items-center rounded-ga"
                      style={{ background: `color-mix(in srgb, ${s.tone} 10%, transparent)`, color: s.tone }}
                    >
                      <Icon size={20} aria-hidden />
                    </span>
                    <span className="font-ga-display text-[15px] font-medium text-ga-subtle">0{i + 1}</span>
                  </div>
                  <p className="mt-3 font-ga-display text-[17px] font-medium text-ga-ink">{t(s.titleKey)}</p>
                  <p className="ga-ui mt-1 text-[13.5px] text-ga-muted">{t(s.descKey)}</p>
                  <span className="ga-ui mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ga-accent">
                    {t('open')} <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </GaCard>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
