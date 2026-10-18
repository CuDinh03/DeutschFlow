'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { GaBtn, GaCap } from '@/components/ui-v2'
import { PERSONA_LIST } from '@/lib/personas'
import {
  COMMON_INTRO_QUESTION,
  INTERVIEW_SAMPLES,
  fillPosition,
  type InterviewPersonaId,
} from '@/data/interviewSamples'

/**
 * Ô "Bạn làm nghề gì?" ở hero trang chủ (đợt 1 A+B+E, khối S2 + S3 của phương án landing).
 *
 * Danh sách vị trí đọc THẲNG từ `PERSONA_LIST` (cùng nguồn với màn chọn phỏng vấn trong app), câu
 * hỏi đọc từ `INTERVIEW_SAMPLES` (chép nguyên văn InterviewQuestionBank, có test đối chiếu). Vì vậy
 * khách thấy câu nào ở đây thì vào app AI hỏi đúng câu đó — không còn kiểu hứa "AI hỏi đúng ngành"
 * cho những ngành chưa có bộ câu hỏi.
 *
 * Nghề chưa có bộ riêng (ví dụ Điều dưỡng, Xây dựng ở thời điểm 19/10/2026) không bị giấu: ô báo
 * thẳng là AI sẽ dùng bộ câu hỏi chung, điều chỉnh theo vị trí người học nhập.
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

/** Gợi ý bấm nhanh: các vị trí phổ biến trong lao động sang Đức, đều đã có bộ câu hỏi riêng. */
const POPULAR_IDS = ['line_cook', 'kellner', 'backend_dev', 'mfa', 'maschinenbediener', 'kassierer']
const DEFAULT_ID = 'line_cook'
const MAX_SUGGESTIONS = 6

/** So khớp không phân biệt hoa thường, dấu tiếng Việt và umlaut tiếng Đức. */
function fold(s: string): string {
  // Khối dấu kết hợp U+0300–U+036F đủ cho dấu tiếng Việt và umlaut sau NFD; "đ" không tách dấu nên thay tay.
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()
}

function search(query: string): Position[] {
  const q = fold(query.trim())
  if (!q) return []
  return POSITIONS.filter((p) =>
    [p.label, p.labelDe, p.personaTag].some((field) => fold(field).includes(q)),
  ).slice(0, MAX_SUGGESTIONS)
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
  const inputId = React.useId()
  const listId = React.useId()
  const [query, setQuery] = React.useState('')
  const [selectedId, setSelectedId] = React.useState(DEFAULT_ID)
  const [active, setActive] = React.useState(0)
  const [open, setOpen] = React.useState(false)

  const suggestions = React.useMemo(() => search(query), [query])
  const selected = POSITIONS.find((p) => p.id === selectedId) ?? POSITIONS[0]
  const noMatch = query.trim().length > 0 && suggestions.length === 0
  const popular = POPULAR_IDS.map((id) => POSITIONS.find((p) => p.id === id)).filter(Boolean) as Position[]

  const choose = (p: Position) => {
    setSelectedId(p.id)
    setQuery('')
    setOpen(false)
    setActive(0)
    onSelect?.(p.id)
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

  const questions = selected
    ? [COMMON_INTRO_QUESTION, ...INTERVIEW_SAMPLES[selected.persona]].map((q) => fillPosition(q, selected.labelDe))
    : []
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
            {suggestions.map((p, i) => (
              <li
                key={p.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); choose(p) }}
                className={`cursor-pointer px-4 py-2.5 ${i === active ? 'bg-ga-yellow-soft' : ''}`}
              >
                <span className="block text-ga-body font-semibold text-ga-ink">{p.labelDe}</span>
                <span className="block text-ga-caption text-ga-muted">{p.label} · {p.personaTag}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label={t('popular')}>
        {popular.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => choose(p)}
            aria-pressed={p.id === selected?.id}
            className={`min-h-9 border px-3 py-1.5 text-ga-small transition-colors ${p.id === selected?.id ? 'border-ga-ink bg-ga-ink text-ga-bg' : 'border-ga-border bg-ga-bg text-ga-ink hover:border-ga-ink'}`}
          >
            {p.labelDe}
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
        ) : selected ? (
          <div>
            <div className="mb-1 flex flex-wrap items-baseline gap-x-2">
              <span className="text-ga-h3 text-ga-ink">{selected.labelDe}</span>
              <span className="text-ga-caption text-ga-muted">{selected.label}</span>
            </div>
            <div className="mb-4 text-ga-caption text-ga-muted">
              {t('interviewer', { name: selected.personaName, tag: selected.personaTag })}
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
        ) : null}
      </div>
    </div>
  )
}
