'use client'

import * as React from 'react'
import { Check, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { formKey, formProgress, type PracticeTeilData } from './practiceModel'
import { SplitPanes } from './SplitPanes'

const paragraphs = (s: string) => s.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

/** Kết quả từng ô sau khi chấm, nếu server trả (hiện chưa có — xem báo cáo đợt 4). */
export interface FormFieldResult {
  given: string | null
  /** Đáp án chuẩn — chỉ có SAU khi chấm. */
  answer?: string | null
  accept?: string[] | null
  isCorrect?: boolean | null
}

interface Props {
  teil: PracticeTeilData
  answers: Record<string, string>
  /** Khoá `form_<i>` (backend chấm theo khoá này). */
  onAnswer: (key: string, value: string | null) => void
  wide: boolean
  tips?: React.ReactNode
  /** Xem lại sau khi chấm: khoá ô nhập. */
  readOnly?: boolean
  /** Theo thứ tự `form_fields`; vắng ⇒ không hiện đúng/sai. */
  results?: FormFieldResult[] | null
}

/**
 * telc A2 Schreiben Teil 1 (FILL_FORM): đọc đoạn văn về một người, điền 5 ô của form. Đề gửi tới học viên đã
 * gỡ `answer`/`accept` (ExamQuestionSanitizer) — màn này chỉ biết tên ô.
 */
export function FormTeilView({ teil, answers, onAnswer, wide, tips, readOnly, results }: Props) {
  const t = useTranslations('v2.student.practice.form')
  const fields = teil.form_fields ?? []
  const progress = formProgress(teil, answers)

  const source = (
    <div className="px-4 py-4 sm:px-6" data-tour="task">
      {tips}
      {teil.instruction_de && <p lang="de" className="ga-ui text-ga-body text-ga-ink">{teil.instruction_de}</p>}
      {teil.instruction_vi && <p className="ga-ui mb-4 mt-1 text-ga-small text-ga-muted">{teil.instruction_vi}</p>}
      <article lang="de" className="flex flex-col gap-3 rounded-ga-touch border border-ga-line bg-ga-card px-4 py-4 text-ga-body-lg leading-[1.7] text-ga-ink">
        {paragraphs(teil.context ?? '').map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
      </article>
    </div>
  )

  const form = (
    <div className="px-4 py-4 sm:px-6">
      <div className="rounded-ga-touch border-[1.5px] border-ga-line-strong bg-ga-card">
        <p lang="de" className="ga-ui border-b border-ga-line bg-ga-side-active px-4 py-2.5 text-ga-body font-semibold text-ga-ink">
          {teil.form_title || t('formFallback')}
        </p>
        <ol className="flex flex-col divide-y divide-ga-line">
          {fields.map((f, i) => {
            const key = formKey(i)
            const id = `form-field-${i}`
            const r = results?.[i]
            return (
              <li key={key} className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
                <label htmlFor={id} lang="de" className="ga-ui w-40 shrink-0 text-ga-body font-semibold text-ga-ink">
                  <span className="mr-1.5 text-ga-muted">{i + 1}</span>{f.field}
                </label>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <input
                    id={id}
                    lang="de"
                    autoComplete="off"
                    spellCheck={false}
                    readOnly={readOnly}
                    value={answers[key] ?? ''}
                    onChange={(e) => onAnswer(key, e.target.value === '' ? null : e.target.value)}
                    className={cn(
                      'ga-ui min-h-11 w-full rounded-ga-touch border-[1.5px] bg-ga-card px-3 text-ga-body-lg text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus',
                      r?.isCorrect === true ? 'border-ga-green' : r?.isCorrect === false ? 'border-ga-red' : 'border-ga-line-strong',
                    )}
                  />
                  {r && r.isCorrect != null && (
                    <p className={cn('ga-ui inline-flex flex-wrap items-center gap-1 text-ga-small font-semibold', r.isCorrect ? 'text-ga-green' : 'text-ga-red')}>
                      {r.isCorrect ? <Check size={14} aria-hidden /> : <X size={14} aria-hidden />}
                      {r.isCorrect ? t('right') : t('wrong')}
                      {r.answer && <span lang="de" className="font-normal text-ga-ink">· {t('answer', { answer: r.answer })}</span>}
                      {r.accept && r.accept.length > 0 && (
                        <span lang="de" className="font-normal text-ga-muted">({t('accept', { list: r.accept.join(', ') })})</span>
                      )}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
      <p className="ga-ui mt-3 text-ga-small text-ga-muted">{t('rule')}</p>
      <p className="ga-ui mt-1 text-ga-small text-ga-muted tabular-nums">{t('progress', { done: progress.done, total: progress.total })}</p>
    </div>
  )

  return <SplitPanes wide={wide} source={source} answers={form} sourceLabel={t('sourceLabel')} answersLabel={t('answersLabel')} />
}
