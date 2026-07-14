'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { MessageCircle, Briefcase, CalendarDays, ArrowRight, Mic } from 'lucide-react'
import { todayApi, type TodayPlan } from '@/lib/todayApi'
import { GaPageHdr, GaCard, GaCap, LoadingState } from '@/components/ui-v2'

// Speaking launcher (v2). The live conversation engine (mic streaming + SSE + TTS) now runs on
// /v2/student/speaking/setup → /v2/student/speaking/live (same engine code as legacy, v2 shell),
// so nothing here deep-links into v1 any more.
// We still pass ?return so exiting the flow lands back on this launcher.

const SETUP_HREF = '/v2/student/speaking/setup'
const LIVE_HREF = '/v2/student/speaking/live'

const RETURN_TO = '/v2/student/speaking'
const withReturn = (href: string) =>
  `${href}${href.includes('?') ? '&' : '?'}return=${encodeURIComponent(RETURN_TO)}`

// Bridge (wave 1): GET /today/me still returns v1 paths ('/speaking?topic=…') — the backend
// switches to v2 paths in wave 2. Until then map path→v2 here and keep the query string
// (CompanionSelect reads ?topic / ?cefr) so the CTA can never land on a dead v1 route.
// Delete this map once the backend emits /v2 paths (it already passes those through untouched).
const V1_TO_V2_SPEAKING: Record<string, string> = {
  '/speaking': SETUP_HREF,
  '/speaking/chat': LIVE_HREF,
  '/speaking/drill': SETUP_HREF,
}

function toV2SpeakingHref(href: string | null | undefined): string {
  if (!href) return SETUP_HREF
  if (href.startsWith('/v2/')) return href
  const [path, query] = href.split('?')
  const mapped = V1_TO_V2_SPEAKING[path]
  if (!mapped) return SETUP_HREF
  return query ? `${mapped}?${query}` : mapped
}

// Interview/lesson are modes of the same picker → ?mode= lands on the right tab.
const MODES = [
  {
    icon: MessageCircle,
    titleKey: 'modes.freeTitle',
    descKey: 'modes.freeDesc',
    href: SETUP_HREF,
    tone: 'var(--ga-violet)',
  },
  {
    icon: Briefcase,
    titleKey: 'modes.interviewTitle',
    descKey: 'modes.interviewDesc',
    href: `${SETUP_HREF}?mode=INTERVIEW`,
    tone: 'var(--ga-blue)',
  },
  {
    icon: CalendarDays,
    titleKey: 'modes.weeklyTitle',
    descKey: 'modes.weeklyDesc',
    href: SETUP_HREF,
    tone: 'var(--ga-teal)',
  },
]

export default function V2StudentSpeakingPage() {
  const t = useTranslations('v2.student.speaking')
  const [today, setToday] = useState<TodayPlan | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    todayApi
      .getMe()
      .then((r) => setToday(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          // Interview RESULTS (report + phase breakdown) — ported to v2; the legacy
          // /student/interviews page is no longer linked from anywhere in /v2.
          <a
            href="/v2/student/interviews"
            className="ga-ui inline-flex items-center gap-1.5 rounded-ga border border-ga-line bg-ga-card px-4 py-2.5 text-[13px] font-semibold text-ga-ink transition-colors hover:bg-ga-surface"
          >
            <Briefcase size={14} aria-hidden /> {t('interviewResults')}
          </a>
        }
      />
      <div className="flex-1 px-10 py-6">
        {/* Recommended */}
        {!loading && today?.recommendedSpeaking?.topic && (
          <a href={withReturn(toV2SpeakingHref(today.recommendedSpeaking.href))}>
            <div className="mb-[22px] flex flex-col items-start gap-4 bg-ga-ink p-7 text-ga-bg md:flex-row md:items-center md:justify-between">
              <div>
                <GaCap className="mb-2 block" style={{ color: '#A39E94' }}>{t('recommendedCap')}</GaCap>
                <p className="font-ga-display text-[24px] font-medium">{today.recommendedSpeaking.topic}</p>
                {today.recommendedSpeaking.cefrLevel && (
                  <p className="ga-ui mt-1.5 text-[14px]" style={{ color: '#A39E94' }}>
                    {t('levelLabel', { level: today.recommendedSpeaking.cefrLevel })}
                  </p>
                )}
              </div>
              <span className="ga-ui inline-flex shrink-0 items-center gap-2 bg-ga-yellow px-5 py-3 text-[14px] font-semibold text-ga-ink">
                <Mic size={16} aria-hidden /> {t('startSpeaking')}
              </span>
            </div>
          </a>
        )}
        {loading && <LoadingState label={t('loading')} />}

        <GaCap className="mb-3 block">{t('modesCap')}</GaCap>
        <div className="grid grid-cols-1 gap-[18px] md:grid-cols-3">
          {MODES.map((m) => {
            const Icon = m.icon
            return (
              <a key={m.titleKey} href={withReturn(m.href)}>
                <GaCard hover className="group h-full p-5">
                  <span
                    className="mb-3 grid h-11 w-11 place-items-center rounded-ga"
                    style={{ background: `${m.tone}1a`, color: m.tone }}
                  >
                    <Icon size={22} aria-hidden />
                  </span>
                  <p className="font-ga-display text-[18px] font-medium text-ga-ink">{t(m.titleKey)}</p>
                  <p className="ga-ui mt-1 text-[13.5px] text-ga-muted">{t(m.descKey)}</p>
                  <span className="ga-ui mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ga-accent">
                    {t('enter')} <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </GaCard>
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}
