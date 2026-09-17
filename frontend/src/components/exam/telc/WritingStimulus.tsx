'use client'

import { useTranslations } from 'next-intl'
import { Mail, Newspaper, FileText } from 'lucide-react'
import type { WritingStimulus as WritingStimulusData } from './writingTask'

/**
 * Văn bản mà bài viết trả lời, in như trên tờ đề telc: E-Mail có dòng Von/Betreff và thân thư,
 * mẩu tin đóng khung, thư có tiêu đề. Học viên phải đọc nó trước — không có nó thì bốn Leitpunkte
 * („Reaktion auf den Vorschlag") không có gì để phản hồi.
 */
export function WritingStimulus({ stimulus }: { stimulus: WritingStimulusData }) {
  const t = useTranslations('v2.student.mockExamRun')
  const type = (stimulus.type ?? 'EMAIL').toUpperCase()
  const isEmail = type === 'EMAIL'
  const Icon = isEmail ? Mail : type === 'AD' ? Newspaper : FileText
  const heading = isEmail ? t('writingStimulusEmail') : type === 'AD' ? t('writingStimulusAd') : t('writingStimulusLetter')

  return (
    <section
      aria-label={heading}
      className="overflow-hidden rounded-ga border-[1.5px] border-ga-line-strong bg-ga-card"
    >
      <header className="flex items-center gap-2 border-b border-ga-line bg-ga-surface px-4 py-2.5">
        <Icon size={15} className="shrink-0 text-ga-muted" aria-hidden />
        <h3 className="ga-ui text-ga-caption font-bold uppercase tracking-wide text-ga-muted">{heading}</h3>
      </header>
      {(stimulus.from || stimulus.subject) && (
        <dl className="ga-ui grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-ga-line px-4 py-3 text-ga-small">
          {stimulus.from && (
            <>
              <dt className="text-ga-muted">{t('writingFrom')}</dt>
              <dd className="min-w-0 break-words font-semibold text-ga-ink">{stimulus.from}</dd>
            </>
          )}
          {stimulus.subject && (
            <>
              <dt className="text-ga-muted">{t('writingSubject')}</dt>
              <dd className="min-w-0 break-words font-semibold text-ga-ink">{stimulus.subject}</dd>
            </>
          )}
        </dl>
      )}
      <div className="ga-ui whitespace-pre-wrap break-words px-4 py-4 text-ga-body leading-relaxed text-ga-ink">
        {stimulus.body}
      </div>
    </section>
  )
}
