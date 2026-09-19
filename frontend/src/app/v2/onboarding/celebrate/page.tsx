'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, BookOpen, Flame, ListChecks, Map, Mic, Repeat, Star, Target } from 'lucide-react'
import { GaBtn, GaIcon } from '@/components/ui-v2'
import { useTracking } from '@/hooks/useTracking'
import { getMyLearningProfile } from '@/lib/profileApi'
import { MENTOR_META } from '@/lib/mentorMeta'
import { parseCelebrateParams, type CelebrateKind } from '@/features/onboarding/celebrate'
import { DASHBOARD_ROUTE } from '@/features/onboarding/postProfileRoute'
import { GaAuthShell } from '../../authShared'

// ─────────────────────────────────────────────────────────────────────────────
// /v2/onboarding/celebrate?kind=beginner|placement|mock_exam[&passed=1|0]
//
// W9 — Ăn mừng (trạng thái `CELEBRATE`, Đợt 4 PR-3 19/09/2026; kế hoạch 17/09 §4.4 W9). Bản web
// của màn ăn mừng mobile trong `first-sentence.tsx`: mentor, hai pill thành quả, "Tuần đầu của
// bạn" bốn mục, CTA vào dashboard (HOME_WEEK1 = checklist tuần đầu W10). Nhẹ: không confetti,
// hiệu ứng vào tôn trọng `prefers-reduced-motion`. Trang KHÔNG ghi activation — server đã hook
// ở chỗ hoàn thành thật (I-12); tham số lạ rơi về `beginner` chứ không 404.
//
// Nằm sau cổng đăng nhập (middleware chỉ miễn /v2/onboarding gốc) — đúng, vì chỉ tới đây sau khi
// một bài đầu tiên đã hoàn thành trên tài khoản thật.
// ─────────────────────────────────────────────────────────────────────────────

const KIND_ICON: Record<CelebrateKind, typeof BookOpen> = { beginner: BookOpen, placement: Target, mock_exam: Mic }
const PILL_KEY: Record<CelebrateKind, string> = { beginner: 'beginner', placement: 'placement', mock_exam: 'mockExam' }

function bodyKey(kind: CelebrateKind, passed: boolean | null): string {
  if (kind === 'beginner') return 'celebrate.body.beginner'
  if (kind === 'mock_exam') return 'celebrate.body.mockExam'
  if (passed === true) return 'celebrate.body.placementPassed'
  if (passed === false) return 'celebrate.body.placementFailed'
  return 'celebrate.body.placement'
}

/** "ANNA" → "Anna" — hồ sơ chỉ giữ mã persona, không giữ tên hiển thị. */
function mentorNameFromCode(code: string): string {
  return code.charAt(0).toUpperCase() + code.slice(1).toLowerCase()
}

export default function V2OnboardingCelebratePage() {
  return (
    <Suspense fallback={null}>
      <CelebrateContent />
    </Suspense>
  )
}

function CelebrateContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('v2.onboarding')
  const { trackEvent } = useTracking()
  const reduceMotion = useReducedMotion()
  const { kind, passed } = parseCelebrateParams((name) => searchParams.get(name))

  const [mentorCode, setMentorCode] = useState<string | null>(null)

  useEffect(() => {
    trackEvent('onboarding_celebrate_viewed', { kind, passed })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mentor là điểm nhấn cảm xúc nhưng không chặn màn: hồ sơ hỏng thì bỏ thẻ mentor, vẫn ăn mừng.
  useEffect(() => {
    let alive = true
    getMyLearningProfile()
      .then((p) => { if (alive) setMentorCode(p.assignedPersonaCode ?? null) })
      .catch(() => { /* non-blocking */ })
    return () => { alive = false }
  }, [])

  const mentorName = mentorCode ? mentorNameFromCode(mentorCode) : null
  const mentorTagline = mentorCode
    ? t.has(`mentorTaglines.${mentorCode}`)
      ? t(`mentorTaglines.${mentorCode}`)
      : MENTOR_META[mentorCode]?.tagline ?? t('mentorTaglines.fallback')
    : null

  const finish = () => {
    trackEvent('onboarding_celebrate_done', { kind })
    router.push(DASHBOARD_ROUTE)
  }

  const KindIcon = KIND_ICON[kind]
  const enter = reduceMotion ? { initial: false as const } : { initial: { opacity: 0, scale: 0.96 } }

  const week = [
    { key: 'roadmap', Icon: Map, title: t('celebrate.week.roadmap.title'), sub: t('celebrate.week.roadmap.sub') },
    mentorName
      ? { key: 'speaking', Icon: Mic, title: t('celebrate.week.speaking.title', { name: mentorName }), sub: t('celebrate.week.speaking.sub') }
      : { key: 'speaking', Icon: Mic, title: t('celebrate.week.speakingNoMentor.title'), sub: t('celebrate.week.speakingNoMentor.sub') },
    { key: 'review', Icon: Repeat, title: t('celebrate.week.review.title'), sub: t('celebrate.week.review.sub') },
    { key: 'checklist', Icon: ListChecks, title: t('celebrate.week.checklist.title'), sub: t('celebrate.week.checklist.sub') },
  ]

  return (
    <GaAuthShell showBackToLanding={false}>
      <motion.div
        {...enter}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.35, ease: 'easeOut' }}
        className="rounded-ga border border-ga-line bg-ga-card p-4 shadow-ga-card-hover lg:p-6"
        data-testid="celebrate"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-ga-pill bg-ga-yellow text-ga-ink" aria-hidden="true">
            <KindIcon size={30} />
          </span>
          <p className="ga-ui text-ga-eyebrow uppercase text-ga-muted">{t('celebrate.cap')}</p>
          <h1 tabIndex={-1} className="font-ga-display text-ga-display-m text-ga-ink outline-none">{t('celebrate.title')}</h1>
          <p className="max-w-md text-ga-small text-ga-muted">{t(bodyKey(kind, passed))}</p>

          <div className="mt-1 flex flex-wrap justify-center gap-2">
            <Pill icon={<Flame size={14} aria-hidden="true" />} label={t('celebrate.pillStreak')} tone="orange" />
            <Pill icon={<Star size={14} aria-hidden="true" />} label={t(`celebrate.pill.${PILL_KEY[kind]}`)} tone="gold" />
          </div>
        </div>

        {mentorName && (
          <div className="mt-5 flex items-center gap-3 rounded-ga border border-ga-gold bg-ga-yellow-soft p-3" data-testid="celebrate-mentor">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-ga-pill bg-ga-yellow">
              <GaIcon name="school" size={22} className="text-ga-ink" />
            </div>
            <div className="min-w-0">
              <p className="ga-ui text-ga-eyebrow uppercase text-ga-muted">{t('celebrate.mentorLabel')}</p>
              <p className="ga-ui text-ga-small font-bold text-ga-ink">{mentorName}</p>
              {mentorTagline && <p className="text-ga-caption text-ga-muted">{mentorTagline}</p>}
            </div>
          </div>
        )}

        <div className="mt-5 rounded-ga border border-ga-line">
          <div className="border-b border-ga-line px-4 py-3">
            <p className="ga-ui text-ga-eyebrow uppercase text-ga-muted">{t('celebrate.weekCap')}</p>
          </div>
          <ol className="divide-y divide-ga-line">
            {week.map(({ key, Icon, title, sub }) => (
              <li key={key} className="flex items-center gap-3 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-ga bg-ga-accent-soft text-ga-accent" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <div className="min-w-0">
                  <p className="ga-ui text-ga-small font-bold text-ga-ink">{title}</p>
                  <p className="text-ga-caption text-ga-muted">{sub}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <GaBtn variant="ink" size="lg" className="mt-5 w-full" onClick={finish} data-testid="celebrate-cta">
          {t('celebrate.cta')} <ArrowRight size={14} aria-hidden="true" />
        </GaBtn>
      </motion.div>
    </GaAuthShell>
  )
}

function Pill({ icon, label, tone }: { icon: React.ReactNode; label: string; tone: 'orange' | 'gold' }) {
  const cls = tone === 'orange' ? 'border-ga-orange text-ga-orange bg-ga-orange-soft' : 'border-ga-gold text-ga-ink bg-ga-yellow-soft'
  return (
    <span className={`ga-ui inline-flex items-center gap-1.5 rounded-ga-pill border px-3 py-1 text-ga-caption font-bold ${cls}`}>
      {icon}
      {label}
    </span>
  )
}
