'use client'

import * as React from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { GaBtn, GaCap } from '@/components/ui-v2'
import { PERSONA_LIST } from '@/lib/personas'
import { occupationApi } from '@/lib/occupationApi'
import {
  occupationName,
  questionLabel,
  type OccupationDetail,
  type OccupationSummary,
} from '@/lib/occupationTypes'
import { DEFAULT_PUBLIC_LOCALE, isPublicLocale, localizedHref } from '@/lib/publicLocale'
import { InterviewerPortrait, PersonaPortrait } from './PersonaPortrait'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { QualityLabel } from './QualityLabel'
import { QuestionTranslation } from './QuestionTranslation'
import { interviewerInfo } from './interviewerInfo'
import {
  COMMON_INTRO_QUESTION,
  INTERVIEW_SAMPLES,
  fillPosition,
  type InterviewPersonaId,
} from '@/data/interviewSamples'

/**
 * Ô "Bạn làm nghề gì?" ở hero trang chủ (khối S2 + S3 của phương án landing).
 *
 * Đợt 2d (20/10/2026): đọc danh mục nghề công khai (`/api/public/occupations`, ~150 nghề) và chi tiết
 * từng nghề — câu mẫu đúng câu phiên phỏng vấn hỏi, nhãn Đã duyệt / AI tạo / Bộ câu hỏi chung, từ
 * chuyên môn, người phỏng vấn của nghề, và lối sang trang `/phong-van/[nghe]/`.
 *
 * Endpoint chưa có (frontend lên trước backend) hoặc lỗi mạng → giữ nguyên cách của đợt 1: vị trí
 * đọc từ `PERSONA_LIST`, câu hỏi từ `INTERVIEW_SAMPLES` (chép nguyên văn InterviewQuestionBank, có
 * test đối chiếu). Khách không bao giờ thấy ô trống.
 */

type Position = {
  id: string
  label: string
  labelDe: string
  persona: InterviewPersonaId
  personaName: string
  personaTag: string
}

const POSITIONS: Position[] = PERSONA_LIST.filter((p) => p.supportsInterview).flatMap((p) =>
  (p.interviewPositions ?? []).map((pos) => ({
    ...pos,
    persona: p.id as InterviewPersonaId,
    personaName: p.name,
    personaTag: p.tag,
  })),
)

/** Gợi ý bấm nhanh khi chạy bằng dữ liệu tĩnh: vị trí phổ biến, đều đã có bộ câu hỏi riêng. */
const POPULAR_IDS = ['line_cook', 'kellner', 'backend_dev', 'mfa', 'maschinenbediener', 'kassierer']
const DEFAULT_ID = 'line_cook'
const MAX_SUGGESTIONS = 6
const MAX_TERMS = 6

/** So khớp không phân biệt hoa thường, dấu tiếng Việt và umlaut tiếng Đức. */
function fold(s: string): string {
  // Khối dấu kết hợp U+0300–U+036F đủ cho dấu tiếng Việt và umlaut sau NFD; "đ" không tách dấu nên thay tay.
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()
}

/** Một lựa chọn trong ô — từ danh mục nghề (remote) hoặc từ vị trí tĩnh của nhân vật. */
type Choice = { key: string; labelDe: string; label: string; hint: string }

function searchChoices(choices: Choice[], fields: (c: Choice) => string[], query: string): Choice[] {
  const q = fold(query.trim())
  if (!q) return []
  return choices.filter((c) => fields(c).some((f) => fold(f).includes(q))).slice(0, MAX_SUGGESTIONS)
}

export function OccupationExplorer({
  startHref,
  onStart,
  onSelect,
}: {
  startHref: string
  /** Bấm nút vào phễu — trang chủ đo bằng `landing_cta_clicked`. */
  onStart: () => void
  onSelect?: (positionId: string) => void
}) {
  const t = useTranslations('v2.landing.explorer')
  const tl = useTranslations('v2.landing')
  const raw = useLocale()
  const locale = isPublicLocale(raw) ? raw : DEFAULT_PUBLIC_LOCALE
  const inputId = React.useId()
  const listId = React.useId()
  const [query, setQuery] = React.useState('')
  const [active, setActive] = React.useState(0)
  const [open, setOpen] = React.useState(false)

  // Danh mục nghề từ backend; null = chưa có (đang tải hoặc lỗi) → chạy bằng dữ liệu tĩnh.
  const [catalog, setCatalog] = React.useState<OccupationSummary[] | null>(null)
  const [details, setDetails] = React.useState<Record<string, OccupationDetail | 'error'>>({})
  React.useEffect(() => {
    let alive = true
    occupationApi.list()
      .then((list) => { if (alive && list.length) setCatalog(list) })
      .catch(() => { /* giữ dữ liệu tĩnh */ })
    return () => { alive = false }
  }, [])

  const remote = catalog !== null
  const choices: Choice[] = React.useMemo(() => (remote
    ? catalog!.map((o) => ({ key: o.code, labelDe: o.nameDe, label: occupationName(o, locale), hint: tl(`workplaces.${o.workplace}`) }))
    : POSITIONS.map((p) => ({ key: p.id, labelDe: p.labelDe, label: p.label, hint: p.personaTag }))),
  [remote, catalog, locale, tl])

  const [selectedKey, setSelectedKey] = React.useState<string | null>(null)
  const selectedChoice = choices.find((c) => c.key === selectedKey)
    ?? choices.find((c) => c.key === (remote ? catalog![0]?.code : DEFAULT_ID))
    ?? choices[0]

  const suggestions = React.useMemo(() => searchChoices(choices, (c) => {
    if (!remote) {
      const p = POSITIONS.find((x) => x.id === c.key)
      return [c.label, c.labelDe, p?.personaTag ?? '']
    }
    const o = catalog!.find((x) => x.code === c.key)
    return [o?.nameDe ?? '', o?.nameVi ?? '', o?.nameEn ?? '', ...(o?.aliases ?? [])]
  }, query), [choices, query, remote, catalog])

  const noMatch = query.trim().length > 0 && suggestions.length === 0
  const popular = remote
    ? choices.slice(0, MAX_SUGGESTIONS)
    : (POPULAR_IDS.map((id) => choices.find((c) => c.key === id)).filter(Boolean) as Choice[])

  // Chi tiết nghề đang chọn (chỉ khi chạy bằng danh mục backend), giữ lại theo mã để bấm qua lại không tải lại.
  const selectedCode = remote ? selectedChoice?.key : undefined
  React.useEffect(() => {
    if (!selectedCode || details[selectedCode]) return
    let alive = true
    occupationApi.detail(selectedCode)
      .then((d) => { if (alive) setDetails((m) => ({ ...m, [selectedCode]: d })) })
      .catch(() => { if (alive) setDetails((m) => ({ ...m, [selectedCode]: 'error' })) })
    return () => { alive = false }
  }, [selectedCode, details])

  const choose = (c: Choice) => {
    setSelectedKey(c.key)
    setQuery('')
    setOpen(false)
    setActive(0)
    onSelect?.(c.key)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestions.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(suggestions[active] ?? suggestions[0])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showList = open && suggestions.length > 0

  return (
    <div className="border border-ga-border bg-ga-card p-5 sm:p-7">
      <GaCap className="mb-3">{t('cap')}</GaCap>
      <label htmlFor={inputId} className="mb-2 block text-ga-h3 text-ga-ink">
        {t('label')}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={query}
          placeholder={t('placeholder')}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0) }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className="block min-h-11 w-full rounded-ga border border-ga-line bg-ga-bg px-4 py-3 text-ga-body-lg text-ga-ink outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
        />
        {showList && (
          <ul
            id={listId}
            role="listbox"
            className="absolute inset-x-0 top-full z-10 mt-1 border border-ga-border bg-ga-card"
          >
            {suggestions.map((c, i) => (
              <li
                key={c.key}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); choose(c) }}
                className={`cursor-pointer px-4 py-2.5 ${i === active ? 'bg-ga-yellow-soft' : ''}`}
              >
                <span className="block text-ga-body font-semibold text-ga-ink">{c.labelDe}</span>
                <span className="block text-ga-caption text-ga-muted">{c.label} · {c.hint}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label={t('popular')}>
        {popular.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => choose(c)}
            aria-pressed={c.key === selectedChoice?.key}
            className={`min-h-9 border px-3 py-1.5 text-ga-small transition-colors ${c.key === selectedChoice?.key ? 'border-ga-ink bg-ga-ink text-ga-bg' : 'border-ga-border bg-ga-bg text-ga-ink hover:border-ga-ink'}`}
          >
            {c.labelDe}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="mt-5 border-t border-ga-border pt-5">
        {noMatch ? (
          <div>
            <div className="mb-2 text-ga-h3 text-ga-ink">{t('noMatchTitle', { query: query.trim() })}</div>
            <p className="mb-4 text-ga-body text-ga-muted">{t('noMatchBody')}</p>
            <GaBtn asChild variant="ink" size="md" className="w-full sm:w-auto">
              <Link href={startHref} onClick={onStart}>{t('ctaGeneral')}</Link>
            </GaBtn>
          </div>
        ) : remote && selectedCode ? (
          <RemoteResult
            detail={details[selectedCode]}
            locale={locale}
            startHref={startHref}
            onStart={onStart}
          />
        ) : selectedChoice ? (
          <StaticResult position={POSITIONS.find((p) => p.id === selectedChoice.key) ?? POSITIONS[0]} startHref={startHref} onStart={onStart} />
        ) : null}
      </div>
    </div>
  )
}

/**
 * Người phỏng vấn nói vài giây khi khách đổi sang nghề khác, như thể vừa đọc câu hỏi. Lần hiện đầu tiên
 * lúc tải trang thì im, để nhân vật chỉ phản ứng với việc khách vừa làm.
 */
function useTalkBurst(key: string | undefined, ms = 2000) {
  const calm = usePrefersReducedMotion()
  const [talking, setTalking] = React.useState(false)
  const last = React.useRef(key)
  React.useEffect(() => {
    if (!key || key === last.current) return
    const first = last.current === undefined
    last.current = key
    if (first || calm) return
    setTalking(true)
    const id = setTimeout(() => setTalking(false), ms)
    return () => clearTimeout(id)
  }, [key, ms, calm])
  return talking
}

/** Kết quả bằng dữ liệu tĩnh của đợt 1 — giữ nguyên khi chưa có danh mục backend. */
function StaticResult({ position, startHref, onStart }: { position: Position; startHref: string; onStart: () => void }) {
  const t = useTranslations('v2.landing.explorer')
  const questions = [COMMON_INTRO_QUESTION, ...INTERVIEW_SAMPLES[position.persona]].map((q) => fillPosition(q, position.labelDe))
  const talking = useTalkBurst(position.id)
  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        {/* Người sẽ phỏng vấn — đúng hình vẽ trong phòng phỏng vấn của app. */}
        <PersonaPortrait id={position.persona} className="w-[72px] shrink-0 sm:w-[84px]" tint={0.24} talking={talking} />
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-baseline gap-x-2">
            <span className="text-ga-h3 text-ga-ink">{position.labelDe}</span>
            <span className="text-ga-caption text-ga-muted">{position.label}</span>
          </div>
          <div className="text-ga-caption text-ga-muted">
            {t('interviewer', { name: position.personaName, tag: position.personaTag })}
          </div>
        </div>
      </div>
      <GaCap className="mb-2">{t('questionsCap')}</GaCap>
      <ol className="mb-4 flex flex-col gap-2.5">
        {questions.map((q, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="shrink-0 font-ga-display text-ga-body-lg font-semibold text-ga-gold">{i + 1}</span>
            <span className="font-ga-display text-ga-body-lg italic text-ga-ink">„{q}“</span>
          </li>
        ))}
      </ol>
      <p className="mb-4 border-l-2 border-ga-yellow pl-3 text-ga-small text-ga-muted">{t('sourceNote')}</p>
      <GaBtn asChild variant="ink" size="md" className="w-full sm:w-auto">
        <Link href={startHref} onClick={onStart}>{t('cta')}</Link>
      </GaBtn>
    </div>
  )
}

/** Kết quả từ chi tiết nghề công khai (đợt 2d). */
function RemoteResult({
  detail,
  locale,
  startHref,
  onStart,
}: {
  detail: OccupationDetail | 'error' | undefined
  locale: 'vi' | 'en' | 'de'
  startHref: string
  onStart: () => void
}) {
  const t = useTranslations('v2.landing.explorer')
  const tl = useTranslations('v2.landing')
  const talking = useTalkBurst(detail && detail !== 'error' ? detail.occupation.code : undefined)
  if (!detail) return <p className="text-ga-body text-ga-muted">{t('loading')}</p>
  if (detail === 'error') {
    return (
      <GaBtn asChild variant="ink" size="md" className="w-full sm:w-auto">
        <Link href={startHref} onClick={onStart}>{t('ctaGeneral')}</Link>
      </GaBtn>
    )
  }
  const o = detail.occupation
  const who = interviewerInfo(detail.personaCode)
  const hasLayer = detail.sampleQuestions.some((q) => q.source !== 'BANK')
  const terms = detail.terms.slice(0, MAX_TERMS)
  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <InterviewerPortrait personaCode={detail.personaCode} className="w-[72px] shrink-0 sm:w-[84px]" tint={0.24} talking={talking} />
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-baseline gap-x-2">
            <span className="text-ga-h3 text-ga-ink">{o.nameDe}</span>
            {locale !== 'de' && <span className="text-ga-caption text-ga-muted">{occupationName(o, locale)}</span>}
          </div>
          {who && (
            <div className="text-ga-caption text-ga-muted">
              {who.kind === 'workplace'
                ? t('interviewerWorkplace', { name: who.name, role: tl(`interviewerRoles.${who.roleKey}`) })
                : t('interviewer', { name: who.name, tag: who.tag })}
            </div>
          )}
        </div>
      </div>
      <GaCap className="mb-2">{t('questionsCap')}</GaCap>
      <ol className="mb-4 flex flex-col gap-3">
        {detail.sampleQuestions.map((q, i) => {
          const kind = questionLabel(q.source, o.questionSet)
          return (
            <li key={i} className="flex items-start gap-3">
              <span className="shrink-0 font-ga-display text-ga-body-lg font-semibold text-ga-gold">{i + 1}</span>
              <div className="min-w-0">
                <span lang="de" className="font-ga-display text-ga-body-lg italic text-ga-ink">„{q.questionDe}“</span>
                <QuestionTranslation q={q} locale={locale} className="mt-0.5 text-ga-small" />
                <div className="mt-1"><QualityLabel kind={kind} text={t(`labels.${kind}`)} /></div>
              </div>
            </li>
          )
        })}
      </ol>
      {terms.length > 0 && (
        <>
          <GaCap className="mb-2">{t('termsCap')}</GaCap>
          <ul className="mb-4 flex flex-wrap gap-2">
            {terms.map((term) => (
              <li key={term.termDe} className="border border-ga-border bg-ga-bg px-3 py-1.5 text-ga-small">
                <span lang="de" className="font-semibold text-ga-ink">{term.termDe}</span>
                {locale !== 'de' && (
                  <span className="text-ga-muted"> · {locale === 'en' ? term.meaningEn : term.meaningVi}</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mb-4 border-l-2 border-ga-yellow pl-3 text-ga-small text-ga-muted">
        {t(hasLayer ? 'sourceNoteLayer' : 'sourceNote')}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <GaBtn asChild variant="ink" size="md" className="w-full sm:w-auto">
          <Link href={startHref} onClick={onStart}>{t('cta')}</Link>
        </GaBtn>
        <Link
          href={localizedHref(locale, `/phong-van/${o.code}`)}
          className="inline-flex min-h-11 items-center border-b-2 border-ga-yellow text-ga-body font-semibold text-ga-ink"
        >
          {t('viewPage')}
        </Link>
      </div>
    </div>
  )
}
