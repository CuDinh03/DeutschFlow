'use client'

import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import type { OptionKey, StudioText } from '@/lib/adminExamStudioApi'
import { markSnippets, splitParagraphs } from '@/lib/examStudioLogic'
import { cn } from '@/lib/utils'

export interface PreviewItem {
  id: string
  question: string
  options: Partial<Record<OptionKey, string>>
  correct?: OptionKey | null
  explanationVi?: string | null
}

interface Props {
  text: StudioText
  items: PreviewItem[]
  quelle?: string | null
  /** Hiện đáp án đúng + giải thích (admin). Tắt để xem như học viên. */
  showAnswers?: boolean
  /** Đoạn trùng nguồn — tô đỏ trong bài. */
  highlightSnippets?: string[]
  /** Số thứ tự câu đầu tiên (telc Lesen T2 đánh 6–10). */
  startNumber?: number
}

const OPTION_KEYS: OptionKey[] = ['a', 'b', 'c']

/** Một Teil Lesen như học viên thấy: tiêu đề, sapo, bài đọc, chú thích, câu hỏi a/b/c, dòng Quelle. */
export function TeilPreview({ text, items, quelle, showAnswers = true, highlightSnippets = [], startNumber = 1 }: Props) {
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
          <p key={i} className="whitespace-pre-line">
            {markSnippets(p, highlightSnippets).map((part, j) =>
              part.hit ? (
                <mark key={j} className="bg-ga-red-soft text-ga-red underline decoration-ga-red">
                  {part.text}
                </mark>
              ) : (
                <span key={j}>{part.text}</span>
              ),
            )}
          </p>
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
                {OPTION_KEYS.filter((k) => it.options[k] != null).map((k) => {
                  const right = showAnswers && it.correct === k
                  return (
                    <li
                      key={k}
                      className={cn(
                        'flex items-start gap-2 rounded-ga px-2.5 py-1.5 text-ga-body',
                        right ? 'bg-ga-green-soft text-ga-ink' : 'text-ga-ink',
                      )}
                    >
                      <span className="w-4 shrink-0 font-semibold text-ga-muted">{k}</span>
                      <span className="min-w-0 flex-1">{it.options[k]}</span>
                      {right && (
                        <span className="inline-flex shrink-0 items-center gap-1 text-ga-caption font-semibold text-ga-green" lang="vi">
                          <Check size={13} aria-hidden /> {t('preview.correct')}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
              {showAnswers && it.explanationVi && (
                <p className="rounded-ga bg-ga-surface px-3 py-2 text-ga-small text-ga-muted" lang="vi">
                  {it.explanationVi}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </article>
  )
}
