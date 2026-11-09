'use client'

import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import type { StudioText } from '@/lib/adminExamStudioApi'
import {
  headlineTable, markSnippets, matchTextIndex, optionKeys, splitMatchTexts, splitParagraphs,
} from '@/lib/examStudioLogic'
import { cn } from '@/lib/utils'

export interface PreviewItem {
  id: string
  question: string
  /** T2: a/b/c. T1 (MATCH_HEADLINE): 2 chữ trong a–j (tiêu đề đúng + tiêu đề nhiễu). */
  options: Record<string, string>
  correct?: string | null
  explanationVi?: string | null
  /** T1: văn bản riêng của câu (content kho mang sẵn); không có thì lấy từ `text.context`. */
  text?: string | null
}

export type PreviewLayout = 'ARTICLE' | 'MATCH_HEADLINE'

interface Props {
  text: StudioText
  items: PreviewItem[]
  quelle?: string | null
  /** Hiện đáp án đúng + giải thích (admin). Tắt để xem như học viên. */
  showAnswers?: boolean
  /** Đoạn trùng nguồn — tô đỏ trong bài. */
  highlightSnippets?: string[]
  /** Số thứ tự câu đầu tiên (telc Lesen T2 đánh 6–10, T1 đánh 1–5). */
  startNumber?: number
  layout?: PreviewLayout
  /** T1: bảng tiêu đề a–j có sẵn (content kho). Không có thì gộp từ phương án các câu. */
  headlines?: Record<string, string> | null
}

function Marked({ text, snippets }: { text: string; snippets: string[] }) {
  return (
    <>
      {markSnippets(text, snippets).map((part, j) =>
        part.hit ? (
          <mark key={j} className="bg-ga-red-soft text-ga-red underline decoration-ga-red">{part.text}</mark>
        ) : (
          <span key={j}>{part.text}</span>
        ),
      )}
    </>
  )
}

/** Một Teil Lesen như học viên thấy. ARTICLE (T2): bài báo + câu a/b/c. MATCH_HEADLINE (T1): 5 văn bản + 10 tiêu đề. */
export function TeilPreview(props: Props) {
  return props.layout === 'MATCH_HEADLINE' ? <MatchHeadlinePreview {...props} /> : <ArticlePreview {...props} />
}

function ArticlePreview({ text, items, quelle, showAnswers = true, highlightSnippets = [], startNumber = 1 }: Props) {
  const t = useTranslations('v2.adminContent.examStudio')
  const paragraphs = splitParagraphs(text.context ?? '')

  return (
    <article className="flex flex-col gap-5 rounded-ga border border-ga-line bg-ga-card px-4 py-5 sm:px-6" lang="de">
      <header className="flex flex-col gap-2">
        <h3 className="font-ga-display text-ga-h2 text-ga-ink">{text.titleDe || t('preview.noTitle')}</h3>
        {text.vorspannDe && <p className="text-ga-body-lg font-semibold text-ga-ink">{text.vorspannDe}</p>}
      </header>

      <div className="flex flex-col gap-3 text-ga-body-lg text-ga-ink">
        {paragraphs.length === 0 && <p className="text-ga-muted" lang="vi">{t('preview.noText')}</p>}
        {paragraphs.map((p, i) => (
          <p key={i} className="whitespace-pre-line"><Marked text={p} snippets={highlightSnippets} /></p>
        ))}
      </div>

      {text.glossary?.length > 0 && (
        <dl className="flex flex-col gap-1 border-t border-ga-line pt-3 text-ga-small text-ga-muted">
          {text.glossary.map((g, i) => (
            <div key={i} className="flex flex-wrap gap-1">
              <dt className="font-semibold text-ga-ink">*{g.term}:</dt>
              <dd>{g.explanationDe}</dd>
            </div>
          ))}
        </dl>
      )}

      {quelle && <p className="text-ga-caption italic text-ga-muted">{quelle}</p>}

      {items.length > 0 && (
        <ol className="flex flex-col gap-4 border-t border-ga-line pt-4">
          {items.map((it, i) => (
            <li key={it.id} className="flex flex-col gap-1.5">
              <p className="text-ga-body font-semibold text-ga-ink">
                <span className="mr-1.5 text-ga-muted">{startNumber + i}</span>
                {it.question}
              </p>
              <ul className="flex flex-col gap-1">
                {optionKeys(it.options).map((k) => {
                  const right = showAnswers && it.correct === k
                  return (
                    <li key={k} className={cn('flex items-start gap-2 rounded-ga px-2.5 py-1.5 text-ga-body text-ga-ink',
                      right && 'bg-ga-green-soft')}>
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
    </article>
  )
}

function MatchHeadlinePreview({ text, items, quelle, showAnswers = true, highlightSnippets = [], startNumber = 1, headlines }: Props) {
  const t = useTranslations('v2.adminContent.examStudio')
  const count = Math.max(items.length, 5)
  const fromContext = splitMatchTexts(text.context, count)
  // Văn bản thứ i ứng với câu LV1-i; câu không mang text riêng thì lấy theo vị trí trong context.
  const texts = Array.from({ length: count }, (_, i) => {
    const it = items[i]
    if (it?.text) return it.text
    return fromContext[it ? matchTextIndex(it.id, i) : i] ?? ''
  })
  const rows = headlines
    ? Object.keys(headlines).sort().map((letter) => {
      const idx = items.findIndex((it) => it.correct === letter)
      return { letter, text: headlines[letter], correct: idx >= 0, itemIndex: idx }
    })
    : headlineTable(items)

  return (
    <article className="flex flex-col gap-5 rounded-ga border border-ga-line bg-ga-card px-4 py-5 sm:px-6" lang="de">
      <ol className="flex flex-col gap-4">
        {texts.map((body, i) => {
          const it = items[i]
          const answer = it?.correct ?? null
          const answerText = answer ? (it?.options?.[answer] || headlines?.[answer] || '') : ''
          return (
            <li key={i} className="flex flex-col gap-1.5">
              <p className="text-ga-body font-semibold text-ga-ink">
                <span className="mr-1.5 text-ga-muted">{startNumber + i}</span>
                {it?.question || `Text ${i + 1}`}
              </p>
              <p className="whitespace-pre-line text-ga-body-lg text-ga-ink">
                {body ? <Marked text={body} snippets={highlightSnippets} /> : <span className="text-ga-muted" lang="vi">{t('preview.noText')}</span>}
              </p>
              {showAnswers && answer && (
                <p className="ga-ui inline-flex items-center gap-1 text-ga-caption font-semibold text-ga-green" lang="vi">
                  <Check size={13} aria-hidden /> {t('preview.matchAnswer', { letter: answer, headline: answerText })}
                </p>
              )}
              {showAnswers && it?.explanationVi && <Explanation text={it.explanationVi} />}
            </li>
          )
        })}
      </ol>

      {quelle && <p className="text-ga-caption italic text-ga-muted">{quelle}</p>}

      {rows.length > 0 && (
        <section className="flex flex-col gap-2 border-t border-ga-line pt-4">
          <h4 className="ga-ui text-ga-small font-semibold text-ga-muted" lang="vi">{t('preview.headlines')}</h4>
          <ul className="flex flex-col gap-1">
            {rows.map((r) => {
              const right = showAnswers && r.correct
              return (
                <li key={`${r.letter}-${r.itemIndex}`} className={cn('flex items-start gap-2 rounded-ga px-2.5 py-1.5 text-ga-body text-ga-ink',
                  right && 'bg-ga-green-soft')}>
                  <span className="w-4 shrink-0 font-semibold text-ga-muted">{r.letter}</span>
                  <span className="min-w-0 flex-1">{r.text}</span>
                  {right && (
                    <span className="ga-ui shrink-0 text-ga-caption font-semibold text-ga-green" lang="vi">
                      {t('preview.matchText', { n: startNumber + r.itemIndex })}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </article>
  )
}

function CorrectMark() {
  const t = useTranslations('v2.adminContent.examStudio')
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-ga-caption font-semibold text-ga-green" lang="vi">
      <Check size={13} aria-hidden /> {t('preview.correct')}
    </span>
  )
}

function Explanation({ text }: { text: string }) {
  return <p className="rounded-ga bg-ga-surface px-3 py-2 text-ga-small text-ga-muted" lang="vi">{text}</p>
}
