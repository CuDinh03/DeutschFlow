'use client'

import * as React from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { DEFAULT_PUBLIC_LOCALE, isPublicLocale, localizedHref } from '@/lib/publicLocale'
import { GaCap } from '@/components/ui-v2'
import { INTERVIEW_SAMPLES, fillPosition, type InterviewPersonaId } from '@/data/interviewSamples'
import { useInViewOnce } from '@/hooks/useInViewOnce'
import { useLookAtPointer } from '@/hooks/useLookAtPointer'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { PERSONA_LIST, type PersonaId } from '@/lib/personas'
import { PersonaPortrait, hasPortrait } from './PersonaPortrait'

/**
 * Dàn người phỏng vấn (làm mới hình ảnh trang chủ 19/10/2026): mỗi nhân vật phỏng vấn của app một
 * thẻ, cùng hình vẽ khách sẽ gặp trong phòng phỏng vấn. Điều dưỡng và Xây dựng ghi "Sắp có" theo
 * sổ lời hứa cho tới khi bộ câu hỏi riêng được duyệt (đợt 2f).
 *
 * 30/10/2026 — nhân vật cất tiếng: chọn một thẻ thì người đó nói câu họ thật sự hỏi trong phiên
 * (`INTERVIEW_SAMPLES`, chép nguyên văn bank) lên dải câu nói. Dải dính dưới header vì lưới 3 cột trên
 * điện thoại cao hơn một màn hình, và là dải chung vì thẻ ở đó quá hẹp cho một bong bóng thoại.
 * Dải có sẵn câu của Klaus trong HTML; câu chỉ chạy chữ khi cuộn tới, rồi dừng.
 */

type CastPersona = (typeof PERSONA_LIST)[number]

/** Tốc độ chạy chữ: đo thật mỗi nhịp mất 30–50ms, nên câu dài ~120 ký tự xong trong khoảng 3 giây. */
const TYPE_MS = 28
const CHARS_PER_TICK = 2
/** Rê chuột lướt qua nhiều thẻ thì chỉ người con trỏ dừng lại mới nói. */
const HOVER_DELAY_MS = 140

/**
 * Đợt B (kế hoạch cải thiện trang chủ 08/11/2026): lưới chính chỉ còn 11 người phỏng vấn theo nghề;
 * bốn nhân vật luyện nói đời sống (không phải nhà tuyển dụng) nằm sau nút "Xem thêm". Bỏ hai thẻ
 * "Sắp có" (owner chốt) — nghề chưa có người riêng thì AI hỏi bằng bộ chung, câu `sub` đã nói rõ.
 */
const JOB_IDS: PersonaId[] = ['klaus', 'niklas', 'nina', 'sarah', 'max', 'oliver', 'lena', 'thomas', 'petra', 'schneider', 'weber']
const LIFE_IDS: PersonaId[] = ['emma', 'anna', 'hannie', 'lukas']
const pick = (ids: PersonaId[]) =>
  ids.map((id) => PERSONA_LIST.find((p) => p.id === id)).filter((p): p is CastPersona => !!p && p.supportsInterview && hasPortrait(p.id))
const JOB_CAST = pick(JOB_IDS)
const LIFE_CAST = pick(LIFE_IDS)
const CAST = [...JOB_CAST, ...LIFE_CAST]
// Nói trước là người có nghề phổ thông, khớp nghề mặc định của ô tìm nghề ở hero.
const FIRST = CAST.find((p) => p.id === 'klaus') ?? CAST[0]

function lineOf(p: CastPersona): string {
  const [question] = INTERVIEW_SAMPLES[p.id as InterviewPersonaId]
  return fillPosition(question, p.interviewPositions?.[0]?.labelDe ?? p.role)
}

function CastSpeech({
  speaker,
  playKey,
  calm,
  hint,
  onDone,
  stageRef,
}: {
  speaker: CastPersona
  /** 0 = chưa ai nói, hiện nguyên câu; tăng lên là chạy chữ lại từ đầu. */
  playKey: number
  calm: boolean
  hint: string
  onDone: () => void
  stageRef: React.Ref<HTMLDivElement>
}) {
  const line = lineOf(speaker)
  const [typed, setTyped] = React.useState(0)
  const animate = playKey > 0 && !calm

  React.useEffect(() => {
    if (!animate) return
    setTyped(0)
    let count = 0
    const id = setInterval(() => {
      count += CHARS_PER_TICK
      setTyped(count)
      if (count >= line.length) {
        clearInterval(id)
        onDone()
      }
    }, TYPE_MS)
    return () => clearInterval(id)
  }, [animate, playKey, line, onDone])

  const visible = animate ? typed : line.length
  return (
    <div ref={stageRef} className="sticky top-16 z-10 mb-4 border border-ga-border bg-ga-card px-4 py-3 sm:px-5 md:top-[78px]">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4">
        <div className="flex min-w-0 items-center gap-2 text-ga-small">
          <span aria-hidden className="inline-block h-[7px] w-[7px] shrink-0 bg-ga-yellow" />
          <strong className="font-semibold text-ga-ink">{speaker.name}</strong>
          <span lang="de" className="truncate text-ga-muted">{speaker.role}</span>
        </div>
        <span className="text-ga-caption text-ga-muted">{hint}</span>
      </div>
      <p lang="de" aria-live="polite" className="sr-only">{speaker.name}: {line}</p>
      {/* Phần chưa chạy tới vẫn chiếm chỗ (invisible) để chữ không nhảy dòng và lưới bên dưới không xô. */}
      <p aria-hidden lang="de" className="min-h-[70px] font-ga-display text-ga-body-lg italic text-ga-ink sm:min-h-[46px]">
        „{line.slice(0, visible)}
        <span className="invisible">{line.slice(visible)}</span>
        <span className={visible < line.length ? 'invisible' : undefined}>“</span>
      </p>
    </div>
  )
}

const CastCard = React.memo(function CastCard({
  persona,
  active,
  talking,
  label,
  onHover,
  onLeave,
  onPick,
}: {
  persona: CastPersona
  active: boolean
  talking: boolean
  label: string
  onHover: (id: PersonaId) => void
  onLeave: () => void
  onPick: (id: PersonaId) => void
}) {
  return (
    <li className={`border bg-ga-card transition-shadow duration-150 hover:shadow-ga-card-hover ${active ? 'border-ga-ink' : 'border-ga-border'}`}>
      <button
        type="button"
        aria-pressed={active}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') onHover(persona.id) }}
        onPointerLeave={onLeave}
        onClick={() => onPick(persona.id)}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ga-focus"
      >
        {/* Tên đọc được = "Xem Klaus hỏi gì" + chữ đang hiện trên thẻ (WCAG 2.5.3: tên phải chứa chữ
            hiển thị — aria-label riêng từng làm Lighthouse báo label-content-name-mismatch). */}
        <span className="sr-only">{label}: </span>
        <PersonaPortrait id={persona.id} talking={talking} />
        <span className="block px-2 pb-2.5 pt-2 sm:px-3 sm:pb-3.5 sm:pt-3">
          <span className="block truncate text-ga-small font-semibold text-ga-ink sm:text-ga-body">{persona.name}</span>
          <span lang="de" className="mt-0.5 block truncate text-ga-caption text-ga-muted sm:text-ga-small">{persona.role}</span>
          <span className="mt-1.5 hidden truncate text-ga-caption text-ga-muted sm:block">{persona.tag}</span>
        </span>
      </button>
    </li>
  )
})

export function CastSection({ className = '' }: { className?: string }) {
  const t = useTranslations('v2.landing.cast')
  const rawLocale = useLocale()
  const locale = isPublicLocale(rawLocale) ? rawLocale : DEFAULT_PUBLIC_LOCALE
  const [showLife, setShowLife] = React.useState(false)
  const calm = usePrefersReducedMotion()
  const [speakerId, setSpeakerId] = React.useState<PersonaId>(FIRST.id)
  const [playKey, setPlayKey] = React.useState(0)
  const [talkingId, setTalkingId] = React.useState<PersonaId | null>(null)
  const talkingRef = React.useRef<PersonaId | null>(null)
  const hoverTimer = React.useRef<ReturnType<typeof setTimeout>>()
  React.useEffect(() => () => clearTimeout(hoverTimer.current), [])

  const speak = React.useCallback((id: PersonaId) => {
    if (talkingRef.current === id) return
    talkingRef.current = calm ? null : id
    setSpeakerId(id)
    setPlayKey((k) => k + 1)
    setTalkingId(talkingRef.current)
  }, [calm])

  const stopTalking = React.useCallback(() => {
    talkingRef.current = null
    setTalkingId(null)
  }, [])

  const onHover = React.useCallback((id: PersonaId) => {
    clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => speak(id), HOVER_DELAY_MS)
  }, [speak])
  const onLeave = React.useCallback(() => clearTimeout(hoverTimer.current), [])

  const sectionRef = useLookAtPointer<HTMLElement>()
  const stageRef = useInViewOnce<HTMLDivElement>(() => speak(FIRST.id), 0.6)
  const speaker = CAST.find((p) => p.id === speakerId) ?? FIRST
  const renderCard = (p: CastPersona) => (
    <CastCard
      key={p.id}
      persona={p}
      active={p.id === speakerId}
      talking={p.id === talkingId}
      label={t('ask', { name: p.name })}
      onHover={onHover}
      onLeave={onLeave}
      onPick={speak}
    />
  )

  return (
    <section ref={sectionRef} id="cast" className={`scroll-mt-[78px] border-y border-ga-border bg-ga-side-active ${className}`}>
      <div className="mx-auto max-w-[1240px] px-5 py-14 sm:px-8 md:py-[78px] lg:px-[60px]">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-[640px]">
            <GaCap className="mb-[18px] text-ga-ink">{t('cap')}</GaCap>
            <h2 className="font-ga-display text-ga-h1-m font-medium tracking-[-0.015em] text-ga-ink lg:text-ga-display">{t('title')}</h2>
          </div>
          <p className="max-w-[400px] text-ga-body text-ga-ink">{t('sub')}</p>
        </div>
        <CastSpeech
          speaker={speaker}
          playKey={playKey}
          calm={calm}
          hint={t('hint')}
          onDone={stopTalking}
          stageRef={stageRef}
        />
        <ul className="grid grid-cols-3 gap-2 sm:gap-4 lg:grid-cols-6">
          {JOB_CAST.map(renderCard)}
        </ul>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <button
            type="button"
            aria-expanded={showLife}
            aria-controls="cast-life"
            onClick={() => setShowLife((v) => !v)}
            className="inline-flex min-h-11 items-center gap-2 border border-ga-ink bg-ga-card px-4 text-ga-small font-semibold text-ga-ink transition-colors hover:bg-ga-bg"
          >
            <span aria-hidden className="inline-block h-[7px] w-[7px] bg-ga-yellow" />
            {showLife ? t('lifeHide') : t('lifeShow', { count: LIFE_CAST.length })}
          </button>
          <Link href={localizedHref(locale, '/phong-van')} className="text-ga-small font-semibold text-ga-ink underline underline-offset-4">
            {t('allJobs')}
          </Link>
        </div>
        {showLife && (
          <div id="cast-life" className="mt-6">
            <GaCap className="mb-3 text-ga-ink">{t('lifeCap')}</GaCap>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
              {LIFE_CAST.map(renderCard)}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
