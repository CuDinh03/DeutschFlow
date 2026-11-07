'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, ChevronDown, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PracticeItemResult, PracticeTeilResult } from '@/lib/telcPracticeApi'
import { ReadingPassage } from '@/components/exam/telc/ReadingPassage'
import { parseGappedText } from '@/components/exam/telc/telcTeil'
import { ItemAnalysis, LetterBadge } from './ItemAnalysis'
import {
  NONE_OF_THEM,
  itemLabel,
  nextUnanswered,
  optionsFor,
  ownerOf,
  sharedPool,
  type PracticeItem,
  type PracticeKind,
  type PracticeTeilData,
} from './practiceModel'

interface Props {
  teil: PracticeTeilData
  kind: Exclude<PracticeKind, 'writing' | 'unknown'>
  answers: Record<string, string>
  onAnswer: (itemId: string, value: string | null) => void
  /** Có sau khi bấm "Kiểm tra Teil này" (hoặc mở lại Teil đã kiểm tra). */
  result: PracticeTeilResult | null
  /** ≥1024px: hai khung (bài bên trái, kho/phân tích bên phải). Dưới đó: một cột + bảng chọn từ đáy. */
  wide: boolean
  tips: React.ReactNode
  /** Khối đặt ngay dưới câu lệnh (Hören: bài nghe cấp Teil). */
  intro?: React.ReactNode
  /** Khối đặt trên câu hỏi của từng câu (Hören: bài nghe của câu). */
  itemExtra?: (item: PracticeItem) => React.ReactNode
}

/**
 * Một Teil khách quan của chế độ luyện đề telc. Thao tác (owner chốt phương án A, 03/11/2026):
 * chạm vào câu → chạm vào đáp án; lựa chọn đã dùng ở câu khác thì viền đứt + chữ nhạt + ghi "ở câu N"
 * (vẫn chọn được — nó chuyển sang câu đang chọn); đúng/sai chỉ hiện sau khi kiểm tra cả Teil.
 */
export function ObjectiveTeilView({ teil, kind, answers, onAnswer, result, wide, tips, intro, itemExtra }: Props) {
  const t = useTranslations('v2.student.practice')
  const items = React.useMemo(() => teil.items ?? [], [teil.items])
  const checked = result != null
  const byId = React.useMemo(() => new Map(result?.items.map((r) => [r.id, r]) ?? []), [result])

  const [active, setActive] = React.useState<string | null>(() => nextUnanswered(items, answers))
  const [selected, setSelected] = React.useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const scrollTarget = React.useRef<string | null>(null)

  // Sau khi kiểm tra: mở sẵn câu sai đầu tiên — đó là câu người học cần đọc nhất.
  React.useEffect(() => {
    if (!result) return
    const firstWrong = result.items.find((r) => !r.isCorrect) ?? result.items[0]
    setSelected(firstWrong?.id ?? null)
    setActive(null)
  }, [result])

  React.useEffect(() => {
    if (!scrollTarget.current) return
    const el = document.getElementById(`pq-${scrollTarget.current}`)
    scrollTarget.current = null
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })

  const pick = (key: string) => {
    if (!active || checked) return
    // Mỗi lựa chọn của kho dùng một lần: lấy lại từ câu đang giữ nó (trừ `x`).
    const holder = sharedPool(teil).length > 0 ? ownerOf(answers, key, items) : undefined
    if (holder && holder !== active) onAnswer(holder, null)
    onAnswer(active, answers[active] === key ? null : key)
    const nextAnswers = { ...answers, [active]: key }
    if (holder && holder !== active) delete nextAnswers[holder]
    const next = nextUnanswered(items, nextAnswers, active)
    setSheetOpen(false)
    if (wide && next) {
      setActive(next)
      scrollTarget.current = next
    } else if (!wide) {
      setActive(next)
    }
  }

  const openItem = (id: string) => {
    if (checked) {
      setSelected((cur) => (!wide && cur === id ? null : id))
      return
    }
    setActive(id)
    if (!wide && kind !== 'mc') setSheetOpen(true)
  }

  const activeItem = items.find((it) => it.id === active) ?? null
  const answered = items.filter((it) => answers[it.id]).length

  // ── kho lựa chọn cho câu đang chọn ─────────────────────────────────────────
  const optionList = (forItem: PracticeItem | null) => {
    if (!forItem) return null
    const opts = optionsFor(teil, forItem)
    const shared = sharedPool(teil).length > 0
    const withNone = teil.allow_none ? [...opts, { key: NONE_OF_THEM, label: t('noneOfThem') }] : opts
    return (
      <div className={cn(kind === 'gap-bank' ? 'grid grid-cols-2 gap-2' : 'space-y-2')} role="radiogroup" aria-label={t('pickFor', { n: itemLabel(forItem) })}>
        {withNone.map((o) => {
          const mine = answers[forItem.id] === o.key
          const holder = shared ? ownerOf(answers, o.key, items) : undefined
          const used = !!holder && holder !== forItem.id
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={mine}
              onClick={() => pick(o.key)}
              className={cn(
                'ga-ui flex min-h-12 w-full items-center gap-3 rounded-ga-touch px-3 py-2 text-left text-ga-body-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-1',
                mine && 'border-[1.5px] border-ga-navy bg-ga-navy text-ga-card',
                !mine && used && 'border-[1.5px] border-dashed border-ga-line text-ga-muted hover:bg-ga-bg',
                !mine && !used && 'border-[1.5px] border-ga-line-strong bg-ga-card text-ga-ink hover:bg-ga-navy-soft',
              )}
            >
              <LetterBadge value={o.key} tone={mine ? 'inverse' : used ? 'muted' : 'outline'} />
              <span lang="de" className="min-w-0 flex-1 break-words">{o.label}</span>
              {(mine || used) && (
                <span className={cn('shrink-0 text-ga-caption', mine ? 'text-ga-card' : 'text-ga-muted')}>
                  {mine ? t('picking') : t('usedAt', { n: itemLabel(items.find((it) => it.id === holder)!) })}
                </span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  // ── bên trái ───────────────────────────────────────────────────────────────
  const left = (
    <div>
      {tips}
      <TaskLine teil={teil} />
      {intro}
      {result && <ScoreLine result={result} />}
      {teil.examples && teil.examples.length > 0 && <Examples examples={teil.examples} />}
      {kind === 'mc' && teil.context && <div className="mb-5"><ReadingPassage teil={teil} /></div>}
      {(kind === 'gap-mc' || kind === 'gap-bank') ? (
        <GappedText
          teil={teil}
          items={items}
          answers={answers}
          active={active}
          selected={selected}
          byId={byId}
          onOpen={openItem}
        />
      ) : (
        items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            kind={kind}
            teil={teil}
            answer={answers[item.id]}
            active={!checked && active === item.id}
            res={byId.get(item.id)}
            selected={selected === item.id}
            wide={wide}
            extra={itemExtra?.(item)}
            onOpen={() => openItem(item.id)}
            onMc={(v) => !checked && onAnswer(item.id, v)}
          />
        ))
      )}
      {!wide && checked && (kind === 'gap-mc' || kind === 'gap-bank') && selected && byId.get(selected) && (
        <div className="mt-4 rounded-ga border border-ga-line bg-ga-card p-4">
          <ItemAnalysis item={byId.get(selected)!} title={t('gapTitle', { n: byId.get(selected)!.label })} />
        </div>
      )}
      {!wide && checked && result && result.unusedOptions.length > 0 && <UnusedOptions result={result} />}
    </div>
  )

  // ── bên phải (≥1024px) ─────────────────────────────────────────────────────
  let right: React.ReactNode = null
  if (wide && checked && result) {
    const sel = selected ? byId.get(selected) : null
    right = (
      <div>
        <p className="ga-ui mb-2.5 text-ga-eyebrow uppercase text-ga-muted">{t('resultsEach')}</p>
        <ul className="mb-4 overflow-hidden rounded-ga-touch border border-ga-line">
          {result.items.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelected(r.id)}
                aria-current={selected === r.id}
                className={cn(
                  'ga-ui flex min-h-12 w-full items-center gap-3 border-b border-ga-line px-3 text-left text-ga-body last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ga-focus',
                  selected === r.id ? 'bg-ga-navy-soft shadow-ga-selected-bar' : 'bg-ga-card hover:bg-ga-bg',
                )}
              >
                <LetterBadge value={r.given ?? '–'} tone={!r.answered ? 'empty' : r.isCorrect ? 'ok' : 'bad'} />
                <span className="min-w-0 flex-1 truncate">
                  {itemTitle(t, kind, r)} · {r.isCorrect ? t('correctShort') : r.answered ? t('wrongShort', { key: r.correct }) : t('emptyShort', { key: r.correct })}
                </span>
                <ChevronRight size={16} className="shrink-0 text-ga-subtle" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        {sel && <ItemAnalysis item={sel} title={itemTitle(t, kind, sel)} />}
        {result.unusedOptions.length > 0 && <UnusedOptions result={result} />}
      </div>
    )
  } else if (wide && kind !== 'mc' && activeItem) {
    right = (
      <div>
        <p className="ga-ui mb-2.5 text-ga-eyebrow uppercase text-ga-muted">
          {kind === 'match' ? t('pickFor', { n: itemLabel(activeItem) }) : t('pickForGap', { n: itemLabel(activeItem) })}
        </p>
        {optionList(activeItem)}
        {kind === 'gap-bank' && <p className="ga-ui mt-3 text-ga-caption text-ga-muted">{t('singleUseHint')}</p>}
      </div>
    )
  }

  return (
    <>
      {wide && right != null ? (
        <div className="grid h-full grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-h-0 overflow-y-auto px-6 py-5">{left}</div>
          <aside className="min-h-0 overflow-y-auto border-l border-ga-line bg-ga-card px-5 py-5">{right}</aside>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[760px] px-3 py-4 lg:px-6 lg:py-5">{left}</div>
      )}

      {!wide && sheetOpen && activeItem && !checked && (
        <BottomSheet
          title={kind === 'match' ? t('pickFor', { n: itemLabel(activeItem) }) : t('pickForGap', { n: itemLabel(activeItem) })}
          hint={activeItem.text ?? activeItem.question}
          onClose={() => setSheetOpen(false)}
        >
          {optionList(activeItem)}
        </BottomSheet>
      )}
      <span className="sr-only" aria-live="polite">{t('answeredCount', { done: answered, total: items.length })}</span>
    </>
  )
}

function itemTitle(t: ReturnType<typeof useTranslations>, kind: Props['kind'], r: PracticeItemResult): string {
  if (kind === 'gap-mc' || kind === 'gap-bank') return t('gapTitle', { n: r.label })
  return t('itemTitle', { n: r.label })
}

function TaskLine({ teil }: { teil: PracticeTeilData }) {
  if (!teil.instruction_de && !teil.instruction_vi) return null
  return (
    <div className="ga-ui mb-4">
      {teil.instruction_de && <p lang="de" className="text-ga-body text-ga-ink">{teil.instruction_de}</p>}
      {teil.instruction_vi && <p className="mt-1 text-ga-small text-ga-muted">{teil.instruction_vi}</p>}
    </div>
  )
}

function ScoreLine({ result }: { result: PracticeTeilResult }) {
  const t = useTranslations('v2.student.practice')
  const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 })
  return (
    <div className="ga-ui mb-4 flex flex-wrap items-center gap-4 border border-ga-line bg-ga-card px-4 py-3">
      <span className="font-ga-display text-ga-stat-m tabular-nums text-ga-ink">
        {fmt(result.score)} <span className="text-ga-body text-ga-muted">/ {fmt(result.max)}</span>
      </span>
      <p className="text-ga-small text-ga-muted">
        <b className="text-ga-ink">{t('scoreCorrect', { done: result.correctCount, total: result.total })}</b>{' '}
        {result.correctCount < result.total ? t('scoreHintWrong') : t('scoreHintAll')}
      </p>
    </div>
  )
}

function Examples({ examples }: { examples: NonNullable<PracticeTeilData['examples']> }) {
  const t = useTranslations('v2.student.practice')
  return (
    <section className="ga-ui mb-4 rounded-ga border border-dashed border-ga-line bg-ga-card px-4 py-3">
      <p className="mb-1.5 text-ga-eyebrow uppercase text-ga-muted">{t('examples')}</p>
      <ol className="space-y-1.5">
        {examples.map((ex, i) => (
          <li key={i} className="flex items-baseline gap-3 text-ga-body">
            <span className="shrink-0 text-ga-small text-ga-muted">{ex.label ?? `0${i + 1}`}</span>
            <span lang="de" className="min-w-0 flex-1">{ex.situation}</span>
            <LetterBadge value={ex.answer} tone="muted" />
          </li>
        ))}
      </ol>
    </section>
  )
}

function highlight(text: string, evidence: string[]): React.ReactNode {
  if (evidence.length === 0) return text
  const parts: React.ReactNode[] = []
  let rest = text
  let key = 0
  for (;;) {
    let best: { at: number; ev: string } | null = null
    for (const ev of evidence) {
      const at = rest.indexOf(ev)
      if (at >= 0 && (best == null || at < best.at)) best = { at, ev }
    }
    if (!best) break
    if (best.at > 0) parts.push(rest.slice(0, best.at))
    parts.push(
      <mark key={key++} className="rounded-ga bg-ga-yellow-soft text-ga-ink shadow-[inset_0_-2px_0_var(--ga-yellow)]">
        {best.ev}
      </mark>,
    )
    rest = rest.slice(best.at + best.ev.length)
  }
  parts.push(rest)
  return parts
}

function ItemCard({
  item,
  kind,
  teil,
  answer,
  active,
  res,
  selected,
  wide,
  extra,
  onOpen,
  onMc,
}: {
  item: PracticeItem
  kind: Props['kind']
  teil: PracticeTeilData
  answer?: string
  active: boolean
  res?: PracticeItemResult
  selected: boolean
  wide: boolean
  extra?: React.ReactNode
  onOpen: () => void
  onMc: (value: string) => void
}) {
  const t = useTranslations('v2.student.practice')
  const label = itemLabel(item)
  const checked = res != null
  const pool = optionsFor(teil, item)
  const answerText = answer === NONE_OF_THEM ? t('noneOfThem') : pool.find((o) => o.key === answer)?.label
  const body = kind === 'match' ? item.text ?? item.question : item.question

  return (
    <article
      id={`pq-${item.id}`}
      className={cn(
        'mb-3.5 scroll-mt-3 border bg-ga-card',
        active ? 'border-ga-navy shadow-ga-selected-bar' : 'border-ga-line',
        checked && (res.isCorrect ? 'shadow-[inset_4px_0_0_var(--ga-green)]' : 'shadow-[inset_4px_0_0_var(--ga-red)]'),
      )}
    >
      <div className="flex items-center gap-2.5 px-4 pt-3">
        <span className="font-ga-display text-ga-h2 text-ga-ink">{label}</span>
        {active && <span className="ga-ui text-ga-caption font-semibold text-ga-navy">{t('picking')}</span>}
        {checked && <StatusPill res={res} />}
      </div>
      {extra && <div className="px-4 pt-2">{extra}</div>}
      {body && (
        <p lang="de" className="ga-ui px-4 pb-3 pt-1.5 text-ga-body-lg leading-relaxed text-ga-ink">
          {checked && selected ? highlight(body, res.evidence) : body}
        </p>
      )}

      {kind === 'mc' ? (
        <div className="space-y-2 border-t border-ga-line bg-ga-bg px-4 py-3" role="radiogroup" aria-label={t('itemTitle', { n: label })}>
          {pool.map((o) => {
            const mine = answer === o.key
            const isRight = checked && o.key === res.correct
            const isWrongPick = checked && mine && !res.isCorrect
            return (
              <button
                key={o.key}
                type="button"
                role="radio"
                aria-checked={mine}
                disabled={checked}
                onClick={() => onMc(o.key)}
                className={cn(
                  'ga-ui flex min-h-12 w-full items-center gap-3 rounded-ga-touch px-3 py-2 text-left text-ga-body-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus',
                  !checked && mine && 'border-[1.5px] border-ga-navy bg-ga-navy text-ga-card',
                  !checked && !mine && 'border-[1.5px] border-ga-line-strong bg-ga-card hover:bg-ga-navy-soft',
                  checked && isRight && 'border-[1.5px] border-ga-green bg-ga-green-soft',
                  checked && isWrongPick && 'border-[1.5px] border-ga-red bg-ga-red-soft',
                  checked && !isRight && !isWrongPick && 'border border-ga-line bg-ga-card text-ga-muted',
                )}
              >
                <LetterBadge value={o.key} tone={isRight ? 'ok' : isWrongPick ? 'bad' : !checked && mine ? 'inverse' : 'outline'} />
                <span lang="de" className="min-w-0 flex-1">{o.label}</span>
              </button>
            )
          })}
        </div>
      ) : !checked ? (
        <button
          type="button"
          onClick={onOpen}
          className="ga-ui flex min-h-14 w-full items-center gap-3 border-t border-ga-line bg-ga-bg px-4 py-2.5 text-left text-ga-body hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ga-focus"
        >
          <LetterBadge value={answer ?? '?'} tone={answer ? 'filled' : 'empty'} />
          {answer ? (
            <span lang="de" className="min-w-0 flex-1 break-words">{answerText}</span>
          ) : (
            <span className="min-w-0 flex-1 text-ga-muted">{wide ? t('pickRight') : t('tapToPick')}</span>
          )}
          {!wide && <ChevronRight size={16} className="shrink-0 text-ga-subtle" aria-hidden />}
        </button>
      ) : null}

      {checked && (
        <div className="ga-ui flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ga-line px-4 py-2.5 text-ga-body">
          {kind !== 'mc' && (
            <span className="flex min-w-0 items-center gap-2">
              <LetterBadge value={res.given ?? '–'} tone={!res.answered ? 'empty' : res.isCorrect ? 'ok' : 'bad'} />
              <span lang="de" className="min-w-0 break-words">{res.givenText ?? t('notAnswered')}</span>
            </span>
          )}
          {kind !== 'mc' && !res.isCorrect && (
            <span className="flex min-w-0 items-center gap-2">
              <ChevronRight size={14} className="text-ga-subtle" aria-hidden />
              <LetterBadge value={res.correct} tone="ok" />
              <span lang="de" className="min-w-0 break-words">{res.correctText}</span>
            </span>
          )}
          <button
            type="button"
            onClick={onOpen}
            aria-expanded={selected}
            className="ga-ui ml-auto inline-flex min-h-10 items-center gap-1 rounded-ga-touch border-[1.5px] border-ga-line-strong px-3 text-ga-small font-semibold hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
          >
            {!wide && selected ? t('hideAnalysis') : t('showAnalysis')}
            {!wide && <ChevronDown size={14} className={cn('transition-transform', selected && 'rotate-180')} aria-hidden />}
          </button>
        </div>
      )}
      {checked && !wide && selected && (
        <div className="border-t border-ga-line px-4 py-4">
          <ItemAnalysis item={res} title={t('itemTitle', { n: label })} />
        </div>
      )}
    </article>
  )
}

function StatusPill({ res }: { res: PracticeItemResult }) {
  const t = useTranslations('v2.student.practice')
  if (res.isCorrect)
    return (
      <span className="ga-ui inline-flex items-center gap-1 rounded-ga-pill bg-ga-green-soft px-2 py-0.5 text-ga-caption font-semibold text-ga-ink">
        <Check size={13} aria-hidden /> {t('correct')}
      </span>
    )
  return (
    <span className="ga-ui inline-flex items-center gap-1 rounded-ga-pill bg-ga-red-soft px-2 py-0.5 text-ga-caption font-semibold text-ga-ink">
      <X size={13} aria-hidden /> {res.answered ? t('wrong') : t('notAnswered')}
    </span>
  )
}

function GappedText({
  teil,
  items,
  answers,
  active,
  selected,
  byId,
  onOpen,
}: {
  teil: PracticeTeilData
  items: PracticeItem[]
  answers: Record<string, string>
  active: string | null
  selected: string | null
  byId: Map<string, PracticeItemResult>
  onOpen: (id: string) => void
}) {
  const t = useTranslations('v2.student.practice')
  const byGap = new Map(items.map((it) => [Number(itemLabel(it)), it]))
  const wordOf = (it: PracticeItem, key?: string) => (key ? optionsFor(teil, it).find((o) => o.key === key)?.label ?? key : '')

  return (
    <>
      {teil.stimulus_ad && (
        <aside className="ga-ui mb-4 whitespace-pre-wrap border-2 border-ga-line bg-ga-card px-4 py-3 text-ga-body text-ga-ink" lang="de">
          {teil.stimulus_ad}
        </aside>
      )}
      <div lang="de" className="ga-ui mb-4 whitespace-pre-wrap break-words border border-ga-line bg-ga-card px-4 py-4 text-ga-body-lg leading-[2.3] text-ga-ink lg:px-5">
        {parseGappedText(teil.gapped_text ?? '').map((seg, i) => {
          if (seg.kind === 'text') return <span key={i}>{seg.value}</span>
          const it = byGap.get(seg.gap)
          if (!it) return <span key={i}>___{seg.gap}___</span>
          const res = byId.get(it.id)
          const a = answers[it.id]
          const isActive = !res && active === it.id
          return (
            <button
              key={i}
              type="button"
              onClick={() => onOpen(it.id)}
              aria-label={t('gapTitle', { n: seg.gap })}
              className={cn(
                'mx-0.5 inline-flex min-h-9 min-w-[5.5rem] items-center gap-1.5 rounded-ga-touch px-2.5 align-middle text-ga-body leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus',
                !res && !a && !isActive && 'border-[1.5px] border-ga-line-strong bg-ga-card',
                !res && isActive && 'border-[1.5px] border-ga-navy bg-ga-navy-soft ring-[3px] ring-ga-navy/20',
                !res && a && !isActive && 'border-[1.5px] border-ga-navy bg-ga-navy font-semibold text-ga-card',
                res?.isCorrect && 'border-[1.5px] border-ga-green bg-ga-green-soft font-semibold',
                res && !res.isCorrect && 'border-[1.5px] border-ga-red bg-ga-red-soft font-semibold',
                res && selected === it.id && 'ring-[3px] ring-ga-navy/30',
              )}
            >
              <span className={cn('text-ga-caption font-semibold', !res && a && !isActive ? 'text-ga-card' : 'text-ga-muted')}>{seg.gap}</span>
              <span className={cn(res && !res.isCorrect && res.answered && 'line-through')}>{wordOf(it, a)}</span>
              {res && !res.isCorrect && <span>→ {res.correctText}</span>}
            </button>
          )
        })}
      </div>
    </>
  )
}

function UnusedOptions({ result }: { result: PracticeTeilResult }) {
  const t = useTranslations('v2.student.practice')
  return (
    <details className="ga-ui mt-4 rounded-ga-touch border border-ga-line bg-ga-card">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-ga-small font-semibold">
        {t('unusedTitle', { count: result.unusedOptions.length })}
        <ChevronDown size={14} aria-hidden />
      </summary>
      <div className="space-y-2 px-3 pb-3 text-ga-small">
        {result.unusedOptions.map((o) => (
          <p key={o.key}>
            <b>
              {o.key} · <span lang="de">{o.text}</span>
            </b>
            {o.note && (
              <>
                <br />
                {o.note}
              </>
            )}
          </p>
        ))}
      </div>
    </details>
  )
}

function BottomSheet({
  title,
  hint,
  onClose,
  children,
}: {
  title: string
  hint?: string
  onClose: () => void
  children: React.ReactNode
}) {
  const t = useTranslations('v2.student.practice')
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[60]">
      <button type="button" aria-label={t('close')} onClick={onClose} className="absolute inset-0 bg-ga-overlay" />
      <div role="dialog" aria-modal="true" aria-label={title} className="absolute inset-x-0 bottom-0 flex max-h-[78%] flex-col rounded-t-[14px] bg-ga-card shadow-ga-drawer">
        <div className="flex items-center gap-2 border-b border-ga-line py-2 pl-4 pr-1">
          <div className="min-w-0 flex-1">
            <p className="ga-ui text-ga-body font-semibold text-ga-ink">{title}</p>
            {hint && <p lang="de" className="ga-ui truncate text-ga-caption text-ga-muted">{hint}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label={t('close')} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-ga-touch text-ga-muted hover:text-ga-ink">
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto px-3.5 py-3">{children}</div>
      </div>
    </div>
  )
}
