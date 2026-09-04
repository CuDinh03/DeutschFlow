'use client'

import { useTranslations } from 'next-intl'
import {
  Clock, Smartphone, BookOpen, AppWindow, DoorOpen, Pen, Glasses, KeyRound, Coffee, Wine, Lamp,
  Armchair, Scissors, FileText, Radio, Shirt, ShoppingBag, CircleDot, Apple, Newspaper, Laptop,
  Phone, Table2, Lightbulb, Image as ImageIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { GaCap } from '@/components/ui-v2'

// Bildkarte A1 T3: icon theo iconKey của đề (asset hình thật bổ sung ở đợt sau — Galerie pipeline).
const ICONS: Record<string, LucideIcon> = {
  clock: Clock, smartphone: Smartphone, book: BookOpen, window: AppWindow, door: DoorOpen, pen: Pen,
  glasses: Glasses, key: KeyRound, cup: Coffee, bottle: Wine, lamp: Lamp, chair: Armchair, scissors: Scissors,
  paper: FileText, radio: Radio, jacket: Shirt, bag: ShoppingBag, ball: CircleDot, apple: Apple,
  newspaper: Newspaper, laptop: Laptop, phone: Phone, table: Table2, light: Lightbulb,
}

interface Props {
  stimulus: Record<string, unknown> | null
  /** Bước hiện tại trong Teil — thẻ tự giới thiệu chỉ lộ từ đánh vần/số khi giám khảo yêu cầu. */
  stepIndex: number
  candidateAction: string
}

/**
 * Thẻ đề như trong phòng thi thật: Themenkarte (Thema + Wort), Bildkarte (hình), thẻ từ khóa
 * tự giới thiệu, và fallback khóa–giá trị cho các stimulus khác (A2+ ở đợt sau).
 */
export function StimulusCard({ stimulus, stepIndex, candidateAction }: Props) {
  const t = useTranslations('v2.student.examSpeaking.stimulus')
  if (!stimulus) {
    return (
      <div className="rounded-ga border border-dashed border-ga-line bg-ga-surface p-5 text-center">
        <p className="ga-ui text-[13px] text-ga-muted">{t('none')}</p>
      </div>
    )
  }
  const type = String(stimulus.type ?? '')

  if (type === 'THEME_CARD') {
    const owner = candidateAction === 'ANSWER' ? t('partnerCard') : t('yourCard')
    return (
      <div
        className="rounded-ga border-2 border-ga-ink bg-ga-card p-5 shadow-[6px_6px_0_0_var(--ga-yellow)]"
        data-testid="stimulus-theme-card"
      >
        <GaCap className="mb-3 block">{owner}</GaCap>
        <p className="ga-ui text-[12px] uppercase tracking-wide text-ga-muted">{t('thema')}</p>
        <p className="font-ga-display text-[22px] font-medium text-ga-ink">{String(stimulus.thema ?? '')}</p>
        <p className="ga-ui mt-4 text-[12px] uppercase tracking-wide text-ga-muted">{t('wort')}</p>
        <p className="font-ga-display text-[34px] font-semibold leading-tight text-ga-ink">{String(stimulus.wort ?? '')}</p>
      </div>
    )
  }

  if (type === 'PICTURE_CARD') {
    const Icon = ICONS[String(stimulus.iconKey ?? '')] ?? ImageIcon
    const owner = candidateAction === 'ANSWER' ? t('partnerCard') : t('yourCard')
    return (
      <div
        className="rounded-ga border-2 border-ga-ink bg-ga-card p-5 shadow-[6px_6px_0_0_var(--ga-yellow)]"
        data-testid="stimulus-picture-card"
      >
        <GaCap className="mb-3 block">{owner}</GaCap>
        <div className="grid h-32 place-items-center rounded-ga bg-ga-surface text-ga-ink">
          <Icon size={64} aria-hidden />
        </div>
        <p className="font-ga-display mt-3 text-center text-[22px] font-medium text-ga-ink">
          {String(stimulus.article ?? '')} {String(stimulus.object ?? '')}
        </p>
        <p className="ga-ui mt-1 text-center text-[12.5px] text-ga-muted">{t('pictureHint')}</p>
      </div>
    )
  }

  if (type === 'KEYWORD_CARD') {
    const keywords = Array.isArray(stimulus.keywords) ? (stimulus.keywords as unknown[]).map(String) : []
    return (
      <div className="rounded-ga border-2 border-ga-ink bg-ga-card p-5 shadow-[6px_6px_0_0_var(--ga-yellow)]" data-testid="stimulus-keyword-card">
        <GaCap className="mb-3 block">{t('yourCard')}</GaCap>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {keywords.map((k) => (
            <li key={k} className="font-ga-display text-[18px] text-ga-ink">{k}</li>
          ))}
        </ul>
        {stepIndex >= 1 && (
          <div className="mt-4 rounded-ga bg-ga-surface p-3">
            <p className="ga-ui text-[12px] uppercase tracking-wide text-ga-muted">{t('spell')}</p>
            <p className="font-ga-display text-[22px] font-medium text-ga-ink">{String(stimulus.spell ?? '')}</p>
          </div>
        )}
        {stepIndex >= 2 && (
          <div className="mt-2 rounded-ga bg-ga-surface p-3">
            <p className="ga-ui text-[12px] uppercase tracking-wide text-ga-muted">{t('number')}</p>
            <p className="font-ga-display text-[22px] font-medium tabular-nums text-ga-ink">{String(stimulus.number ?? '')}</p>
          </div>
        )}
      </div>
    )
  }

  if (type === 'PERSON_CARD') {
    const owner = candidateAction === 'ANSWER' ? t('partnerCard') : t('yourCard')
    return (
      <div className="rounded-ga border-2 border-ga-ink bg-ga-card p-5 shadow-[6px_6px_0_0_var(--ga-yellow)]" data-testid="stimulus-person-card">
        <GaCap className="mb-3 block">{owner}</GaCap>
        <p className="ga-ui text-[12px] uppercase tracking-wide text-ga-muted">{t('keyword')}</p>
        <p className="font-ga-display text-[36px] font-semibold leading-tight text-ga-ink">{String(stimulus.keyword ?? '')}</p>
        <p className="ga-ui mt-3 text-[12.5px] text-ga-muted">{candidateAction === 'ANSWER' ? t('personAnswerHint') : t('personAskHint')}</p>
      </div>
    )
  }

  if (type === 'QUESTION_WORD_CARD') {
    const owner = candidateAction === 'ANSWER' ? t('partnerCard') : t('yourCard')
    return (
      <div className="rounded-ga border-2 border-ga-ink bg-ga-card p-5 shadow-[6px_6px_0_0_var(--ga-yellow)]" data-testid="stimulus-question-word-card">
        <GaCap className="mb-3 block">{owner}</GaCap>
        <p className="ga-ui text-[12px] uppercase tracking-wide text-ga-muted">{t('thema')}</p>
        <p className="font-ga-display text-[22px] font-medium text-ga-ink">{String(stimulus.thema ?? '')}</p>
        <p className="ga-ui mt-4 text-[12px] uppercase tracking-wide text-ga-muted">{t('questionWord')}</p>
        <p className="font-ga-display text-[34px] font-semibold leading-tight text-ga-ink">{String(stimulus.questionWord ?? '')}</p>
      </div>
    )
  }

  if (type === 'PROMPT_CARD') {
    const hints = Array.isArray(stimulus.hints) ? (stimulus.hints as unknown[]).map(String) : []
    return (
      <div className="rounded-ga border-2 border-ga-ink bg-ga-card p-5 shadow-[6px_6px_0_0_var(--ga-yellow)]" data-testid="stimulus-prompt-card">
        <GaCap className="mb-3 block">{t('yourCard')}</GaCap>
        <p className="font-ga-display text-[24px] font-medium leading-snug text-ga-ink">{String(stimulus.prompt ?? '')}</p>
        {hints.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {hints.map((h) => (
              <li key={h} className="ga-ui rounded-ga bg-ga-surface px-3 py-1.5 text-[14px] text-ga-ink">{h}</li>
            ))}
          </ul>
        )}
        <p className="ga-ui mt-3 text-[12.5px] text-ga-muted">{t('promptHint')}</p>
      </div>
    )
  }

  if (type === 'CALENDAR_PAIR') {
    // Chỉ lịch CỦA THÍ SINH — server đã lược partnerCalendar; client cũng không bao giờ đọc khóa partner*.
    const cal = (stimulus.candidateCalendar ?? {}) as Record<string, unknown>
    const days = Object.keys(cal)
    return (
      <div className="rounded-ga border-2 border-ga-ink bg-ga-card p-5 shadow-[6px_6px_0_0_var(--ga-yellow)]" data-testid="stimulus-calendar-card">
        <GaCap className="mb-2 block">{t('situation')}</GaCap>
        <p className="ga-ui text-[15px] text-ga-ink">{String(stimulus.situation ?? '')}</p>
        {stimulus.goal ? <p className="ga-ui mt-1 text-[13px] font-semibold text-ga-ink">{String(stimulus.goal)}</p> : null}
        <p className="ga-ui mt-4 text-[12px] uppercase tracking-wide text-ga-muted">{t('yourCalendar')}</p>
        <table className="mt-1 w-full border-collapse text-[13px]">
          <tbody>
            {days.map((d) => {
              const v = cal[d]
              const items = Array.isArray(v) ? (v as unknown[]).map(String) : [String(v ?? '')]
              const free = items.every((x) => /frei/i.test(x))
              return (
                <tr key={d} className="border-t border-ga-line">
                  <th scope="row" className="ga-ui w-28 py-1.5 text-left font-semibold text-ga-ink">{d}</th>
                  <td className={`ga-ui py-1.5 ${free ? 'text-ga-green' : 'text-ga-ink'}`}>{items.join(' · ')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="ga-ui mt-3 text-[12.5px] text-ga-muted">{t('partnerHasOtherCalendar')}</p>
      </div>
    )
  }

  if (type === 'PLANNING_CARD') {
    const prompts = Array.isArray(stimulus.prompts) ? (stimulus.prompts as unknown[]).map(String) : []
    return (
      <div className="rounded-ga border-2 border-ga-ink bg-ga-card p-5 shadow-[6px_6px_0_0_var(--ga-yellow)]" data-testid="stimulus-planning-card">
        <GaCap className="mb-2 block">{t('situation')}</GaCap>
        <p className="ga-ui text-[15px] text-ga-ink">{String(stimulus.situation ?? '')}</p>
        {prompts.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {prompts.map((p) => (
              <li key={p} className="ga-ui flex items-start gap-2 text-[14px] text-ga-ink">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ga-ink" aria-hidden /> {p}
              </li>
            ))}
          </ul>
        )}
        <p className="ga-ui mt-3 text-[12.5px] text-ga-muted">{t('planningHint')}</p>
      </div>
    )
  }

  // B2 T1 (Goethe „Vortrag halten" / telc „Präsentation"): thẻ chủ đề để trình bày.
  // Thí sinh được rút nhiều thẻ rồi chọn 1 — màn chọn nằm ở trang prep, thẻ này chỉ hiển thị thẻ đã chọn.
  if (type === 'TOPIC_CHOICE') {
    const aspects = Array.isArray(stimulus.aspects) ? (stimulus.aspects as unknown[]).map(String) : []
    return (
      <div className="rounded-ga border-2 border-ga-ink bg-ga-card p-5 shadow-[6px_6px_0_0_var(--ga-yellow)]" data-testid="stimulus-topic-choice-card">
        <GaCap className="mb-2 block">{t('yourTopic')}</GaCap>
        {stimulus.context ? <p className="ga-ui mb-2 text-[12.5px] text-ga-muted">{String(stimulus.context)}</p> : null}
        <p className="ga-ui text-[17px] font-semibold leading-snug text-ga-ink">{String(stimulus.topic ?? '')}</p>
        {aspects.length > 0 && (
          <ol className="mt-3 space-y-1.5">
            {aspects.map((a, i) => (
              <li key={a} className="ga-ui flex items-start gap-2 text-[14px] text-ga-ink">
                <span className="ga-ui mt-[1px] shrink-0 font-semibold text-ga-muted">{i + 1}.</span> {a}
              </li>
            ))}
          </ol>
        )}
        {stimulus.structureHint ? (
          <p className="ga-ui mt-3 text-[12.5px] text-ga-muted">{String(stimulus.structureHint)}</p>
        ) : null}
        {stimulus.instruction ? (
          <p className="ga-ui mt-2 text-[12.5px] text-ga-muted">{String(stimulus.instruction)}</p>
        ) : null}
      </div>
    )
  }

  // B2 T2 „Diskussion": Goethe dùng DEBATE_CARD (chỉ câu hỏi), telc dùng DEBATE_TEXT (thêm đoạn text).
  // partnerStance là lập trường riêng của partner-AI — đã bị lược ở server, không bao giờ tới đây.
  if (type === 'DEBATE_CARD' || type === 'DEBATE_TEXT') {
    return (
      <div className="rounded-ga border-2 border-ga-ink bg-ga-card p-5 shadow-[6px_6px_0_0_var(--ga-yellow)]" data-testid="stimulus-debate-card">
        <GaCap className="mb-2 block">{t('debate')}</GaCap>
        {stimulus.context ? <p className="ga-ui mb-2 text-[12.5px] text-ga-muted">{String(stimulus.context)}</p> : null}
        {stimulus.text ? (
          <blockquote className="mb-3 border-l-4 border-ga-yellow pl-3 ga-ui text-[14px] italic leading-relaxed text-ga-ink">
            {String(stimulus.text)}
          </blockquote>
        ) : null}
        <p className="ga-ui text-[17px] font-semibold leading-snug text-ga-ink">{String(stimulus.question ?? '')}</p>
        <p className="ga-ui mt-3 text-[12.5px] text-ga-muted">{String(stimulus.instruction ?? t('debateHint'))}</p>
      </div>
    )
  }

  if (type === 'FOLIEN_DECK') {
    const folien = Array.isArray(stimulus.folien) ? (stimulus.folien as unknown[]).map(String) : []
    return (
      <div className="rounded-ga border-2 border-ga-ink bg-ga-card p-5 shadow-[6px_6px_0_0_var(--ga-yellow)]" data-testid="stimulus-folien-card">
        <GaCap className="mb-2 block">{t('topic')}</GaCap>
        <p className="font-ga-display text-[22px] font-medium leading-snug text-ga-ink">{String(stimulus.topic ?? '')}</p>
        <ol className="mt-4 space-y-2">
          {folien.map((f, i) => (
            <li key={f} className="flex items-start gap-3 rounded-ga bg-ga-surface p-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-ga bg-ga-ink font-ga-display text-[14px] font-semibold text-ga-bg">{i + 1}</span>
              <span className="ga-ui text-[13.5px] text-ga-ink">{f}</span>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  if (type === 'PARTNER_PRESENTATION') {
    // Văn bản bài trình bày của partner nằm ở khóa partner* (server không gửi) — nó đến dưới dạng lượt nói.
    return (
      <div className="rounded-ga border-2 border-ga-ink bg-ga-card p-5 shadow-[6px_6px_0_0_var(--ga-yellow)]" data-testid="stimulus-partner-presentation-card">
        <GaCap className="mb-2 block">{t('partnerTopic')}</GaCap>
        <p className="font-ga-display text-[22px] font-medium leading-snug text-ga-ink">{String(stimulus.topic ?? '')}</p>
        <p className="ga-ui mt-3 text-[13.5px] text-ga-ink">{String(stimulus.instruction ?? t('feedbackHint'))}</p>
      </div>
    )
  }

  if (type === 'CONTACT_CARD') {
    const topics = Array.isArray(stimulus.topics) ? (stimulus.topics as unknown[]).map(String) : []
    return (
      <div className="rounded-ga border-2 border-ga-ink bg-ga-card p-5 shadow-[6px_6px_0_0_var(--ga-yellow)]" data-testid="stimulus-contact-card">
        <GaCap className="mb-2 block">{t('yourCard')}</GaCap>
        <p className="ga-ui text-[13.5px] text-ga-ink">{String(stimulus.instruction ?? '')}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {topics.map((h) => (
            <li key={h} className="ga-ui rounded-ga bg-ga-surface px-3 py-1.5 text-[14px] text-ga-ink">{h}</li>
          ))}
        </ul>
      </div>
    )
  }

  if (type === 'TOPIC_GRAPHIC_PAIR') {
    const chart = (stimulus.candidateChart ?? null) as { title?: string; unit?: string; series?: { label: string; value: number }[] } | null
    const series = chart?.series ?? []
    const max = Math.max(1, ...series.map((s) => Number(s.value) || 0))
    return (
      <div className="rounded-ga border-2 border-ga-ink bg-ga-card p-5 shadow-[6px_6px_0_0_var(--ga-yellow)]" data-testid="stimulus-graphic-card">
        <GaCap className="mb-2 block">{t('vorlageA')}</GaCap>
        <p className="font-ga-display text-[20px] font-medium leading-snug text-ga-ink">{String(stimulus.thema ?? '')}</p>
        <p className="ga-ui mt-2 text-[13.5px] text-ga-ink">{String(stimulus.candidateText ?? '')}</p>
        {chart && series.length > 0 && (
          <figure className="mt-4">
            <figcaption className="ga-ui text-[12px] uppercase tracking-wide text-ga-muted">{chart.title}</figcaption>
            <svg viewBox={`0 0 320 ${series.length * 26 + 4}`} className="mt-1 w-full" role="img" aria-label={chart.title ?? ''}>
              {series.map((s, i) => {
                const w = Math.round((Number(s.value) / max) * 190)
                const y = i * 26
                return (
                  <g key={s.label} transform={`translate(0, ${y})`}>
                    <text x="0" y="16" fontSize="11" fill="currentColor" className="text-ga-ink">{s.label}</text>
                    <rect x="110" y="4" width={w} height="16" fill="var(--ga-yellow)" stroke="var(--ga-ink)" />
                    <text x={116 + w} y="16" fontSize="11" fill="currentColor" className="text-ga-ink">
                      {s.value}{chart.unit ?? ''}
                    </text>
                  </g>
                )
              })}
            </svg>
          </figure>
        )}
        <p className="ga-ui mt-2 text-[12.5px] text-ga-muted">{String(stimulus.instruction ?? '')}</p>
      </div>
    )
  }

  // Fallback: các loại đề đợt sau (B2 Vortrag, Debatte…) vẫn hiện được nội dung thô — không bao giờ lộ khóa partner*.
  const entries = Object.entries(stimulus).filter(([k]) => k !== 'type' && !k.startsWith('partner'))
  return (
    <div className="rounded-ga border-2 border-ga-ink bg-ga-card p-5" data-testid="stimulus-generic-card">
      <GaCap className="mb-3 block">{t('yourCard')}</GaCap>
      <dl className="space-y-2">
        {entries.map(([k, v]) => (
          <div key={k}>
            <dt className="ga-ui text-[12px] uppercase tracking-wide text-ga-muted">{k}</dt>
            <dd className="ga-ui text-[15px] text-ga-ink">{Array.isArray(v) ? v.map(String).join(', ') : String(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
