'use client'

import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import {
  AD_LETTERS, buildGappedText, itemNumber, optionKeys, parseGappedText, splitParagraphs, type GapSegment,
} from '@/lib/examStudioLogic'
import { cn } from '@/lib/utils'
import { CorrectMark, Explanation, type PreviewItem, type TeilPreviewProps } from './TeilPreview'

// Xem trước như học viên cho các Teil soạn theo tình huống (đợt 3): Lesen T3 (rao vặt + x), Sprachbausteine
// T1/T2 (thư có ô) và Schreiben (E-Mail + 4 Leitpunkte). Chế độ admin (showAnswers) đánh dấu đáp án.

const shell = 'flex flex-col gap-5 rounded-ga border border-ga-line bg-ga-card px-4 py-5 sm:px-6'

/** Lesen T3: ví dụ 01/02, 10 tình huống (11–20), 12 mẩu rao vặt a–l; đáp án có thể là x. */
export function MatchAdPreview({ text, items, quelle, showAnswers = true, startNumber = 11 }: TeilPreviewProps) {
  const t = useTranslations('v2.adminContent.examStudio')
  const ads = text.ads ?? {}
  const answerOf = new Map<string, number[]>()
  items.forEach((it, i) => {
    if (it.correct && it.correct !== 'x') {
      answerOf.set(it.correct, [...(answerOf.get(it.correct) ?? []), itemNumber(it.id, startNumber + i)])
    }
  })

  return (
    <article className={shell} lang="de">
      {(text.examples ?? []).length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h4 className="ga-ui text-ga-small font-semibold text-ga-muted" lang="vi">{t('preview.examples')}</h4>
          <ul className="flex flex-col gap-1">
            {(text.examples ?? []).map((e) => (
              <li key={e.label} className="flex items-start gap-2 text-ga-body text-ga-ink">
                <span className="w-6 shrink-0 font-semibold text-ga-muted">{e.label}</span>
                <span className="min-w-0 flex-1">{e.situation}</span>
                <span className="shrink-0 rounded-ga border border-ga-line px-1.5 font-semibold">{e.answer}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ol className="flex flex-col gap-2">
        {items.map((it, i) => {
          const n = itemNumber(it.id, startNumber + i)
          return (
            <li key={it.id} className="flex flex-col gap-1">
              <p className="flex items-start gap-2 text-ga-body text-ga-ink">
                <span className="w-6 shrink-0 font-semibold text-ga-muted">{n}</span>
                <span className="min-w-0 flex-1">{it.question}</span>
                {showAnswers && it.correct && (
                  <span className="ga-ui shrink-0 rounded-ga bg-ga-green-soft px-1.5 text-ga-caption font-semibold text-ga-green" lang="vi">
                    {it.correct === 'x' ? t('preview.adNone') : t('preview.adAnswer', { k: it.correct })}
                  </span>
                )}
              </p>
              {showAnswers && it.explanationVi && <Explanation text={it.explanationVi} />}
            </li>
          )
        })}
      </ol>

      <section className="grid grid-cols-1 gap-2 border-t border-ga-line pt-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={t('preview.ads')}>
        {AD_LETTERS.map((k) => {
          const used = showAnswers ? answerOf.get(k) : undefined
          return (
            <div key={k} className={cn('flex flex-col gap-1 rounded-ga border px-3 py-2', used ? 'border-ga-green bg-ga-green-soft' : 'border-ga-line')}>
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold text-ga-ink">{k}</span>
                {used && <span className="ga-ui text-ga-caption font-semibold text-ga-green" lang="vi">{t('preview.adFor', { list: used.join(', ') })}</span>}
              </span>
              <p className="whitespace-pre-line text-ga-small text-ga-ink">{ads[k] || '—'}</p>
            </div>
          )
        })}
      </section>
      {quelle && <p className="text-ga-caption italic text-ga-muted">{quelle}</p>}
    </article>
  )
}

function gapItem(items: PreviewItem[], seg: Extract<GapSegment, { kind: 'gap' }>): PreviewItem | undefined {
  return items.find((it) => it.id === seg.itemId)
    ?? items.find((it, i) => (it.meta?.gap ?? String(itemNumber(it.id, i))) === seg.gap)
}

/** Sprachbausteine T1 (a/b/c) và T2 (hộp từ a–o): thư có ô, câu hỏi / hộp từ, đáp án ở chế độ admin. */
export function GapPreview({
  text, items, quelle, showAnswers = true, gappedText, onGapClick, wordBankMode,
}: TeilPreviewProps & { wordBankMode: boolean }) {
  const t = useTranslations('v2.adminContent.examStudio')
  const segments = gappedText
    ? parseGappedText(gappedText, Object.fromEntries(items.map((it, i) => [it.meta?.gap ?? String(itemNumber(it.id, i)), it.id])))
    : items.length > 0
      ? buildGappedText(text.context ?? '', items).segments
      : [{ kind: 'text' as const, text: text.context ?? '' }]
  const bank = text.wordBank ?? {}

  const answerText = (it: PreviewItem | undefined) => {
    if (!it?.correct) return ''
    return wordBankMode ? `${it.correct} ${bank[it.correct as keyof typeof bank] ?? ''}`.trim() : `${it.correct} ${it.options[it.correct] ?? ''}`.trim()
  }

  return (
    <article className={shell} lang="de">
      {wordBankMode && text.stimulusAd && (
        <section className="rounded-ga border border-ga-line bg-ga-surface px-4 py-3">
          {splitParagraphs(text.stimulusAd).map((p, i) => <p key={i} className="whitespace-pre-line text-ga-body text-ga-ink">{p}</p>)}
        </section>
      )}

      {wordBankMode && (
        <section aria-label={t('preview.wordBank')} className="grid grid-cols-3 gap-1.5 rounded-ga border border-ga-line p-3 sm:grid-cols-5">
          {Object.keys(bank).sort().map((k) => {
            const used = showAnswers && items.some((it) => it.correct === k)
            return (
              <span key={k} className={cn('flex items-baseline gap-1.5 rounded-ga px-2 py-1 text-ga-small',
                used ? 'bg-ga-green-soft text-ga-ink' : 'text-ga-ink')}>
                <span className="font-semibold text-ga-muted">{k}</span>{bank[k as keyof typeof bank]}
              </span>
            )
          })}
        </section>
      )}

      <div className="whitespace-pre-line text-ga-body-lg leading-relaxed text-ga-ink">
        {segments.map((seg, i) => {
          if (seg.kind === 'text') return <span key={i}>{seg.text}</span>
          const it = gapItem(items, seg)
          const label = showAnswers && it?.correct ? `${seg.gap} · ${answerText(it)}` : seg.gap
          const cls = cn('mx-0.5 inline-flex items-baseline rounded-ga border px-1.5 text-ga-small font-semibold',
            showAnswers && it?.correct ? 'border-ga-green bg-ga-green-soft text-ga-green' : 'border-ga-ink text-ga-ink')
          return onGapClick && it ? (
            <button key={i} type="button" className={cn(cls, 'hover:bg-ga-surface')} onClick={() => onGapClick(it.id)}
              aria-label={t('preview.gapJump', { n: seg.gap })}>{label}</button>
          ) : (
            <span key={i} className={cls}>{label}</span>
          )
        })}
      </div>

      {quelle && <p className="text-ga-caption italic text-ga-muted">{quelle}</p>}

      {!wordBankMode && items.length > 0 && (
        <ol className="grid grid-cols-1 gap-3 border-t border-ga-line pt-4 sm:grid-cols-2">
          {items.map((it, i) => (
            <li key={it.id} className="flex flex-col gap-1">
              <p className="text-ga-body font-semibold text-ga-ink">{it.meta?.gap ?? itemNumber(it.id, i + 1)}</p>
              <ul className="flex flex-col gap-0.5">
                {optionKeys(it.options).map((k) => {
                  const right = showAnswers && it.correct === k
                  return (
                    <li key={k} className={cn('flex items-start gap-2 rounded-ga px-2 py-1 text-ga-body text-ga-ink', right && 'bg-ga-green-soft')}>
                      <span className="w-4 shrink-0 font-semibold text-ga-muted">{k}</span>
                      <span className="min-w-0 flex-1">{it.options[k]}</span>
                      {right && <CorrectMark />}
                    </li>
                  )
                })}
              </ul>
              {showAnswers && it.explanationVi && <Explanation text={it.explanationVi} />}
            </li>
          ))}
        </ol>
      )}
      {wordBankMode && showAnswers && items.some((it) => it.explanationVi) && (
        <ol className="flex flex-col gap-1.5 border-t border-ga-line pt-4">
          {items.map((it, i) => it.explanationVi && (
            <li key={it.id} className="flex items-start gap-2 text-ga-small">
              <span className="w-6 shrink-0 font-semibold text-ga-muted">{it.meta?.gap ?? itemNumber(it.id, i + 1)}</span>
              <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-ga-green"><Check size={12} aria-hidden />{answerText(it)}</span>
              <span className="min-w-0 flex-1 text-ga-muted" lang="vi">{it.explanationVi}</span>
            </li>
          ))}
        </ol>
      )}
    </article>
  )
}

/** Schreiben: E-Mail của bạn trong khung thư + 4 Leitpunkte (đề thật in không theo thứ tự). */
export function EmailPreview({ text }: TeilPreviewProps) {
  const t = useTranslations('v2.adminContent.examStudio')
  const st = text.stimulus
  return (
    <article className={shell} lang="de">
      <section className="flex flex-col overflow-hidden rounded-ga border border-ga-line">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-b border-ga-line bg-ga-surface px-4 py-2 text-ga-small">
          <dt className="font-semibold text-ga-muted">Von:</dt><dd className="text-ga-ink">{st?.from || '—'}</dd>
          <dt className="font-semibold text-ga-muted">Betreff:</dt><dd className="text-ga-ink">{st?.subject || '—'}</dd>
        </dl>
        <div className="flex flex-col gap-2 px-4 py-3 text-ga-body-lg text-ga-ink">
          {st?.body
            ? splitParagraphs(st.body).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)
            : <p className="text-ga-muted" lang="vi">{t('preview.noText')}</p>}
        </div>
      </section>
      {(text.writingPoints ?? []).length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h4 className="ga-ui text-ga-small font-semibold text-ga-muted" lang="vi">{t('preview.writingPoints')}</h4>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-ga-body text-ga-ink">
            {(text.writingPoints ?? []).map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </section>
      )}
    </article>
  )
}
