'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, ChevronRight, FileText, RotateCcw } from 'lucide-react'
import { useFmt } from '@/lib/i18n/useFmt'
import type { AttemptResult, PartialInfo } from '@/lib/exam/mockAttemptApi'
import type { FullTeil } from '@/components/exam/practice/fullExamModel'
import { Glyph, SECTION_ICON } from '@/components/exam/today/visual'

const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 })

interface Props {
  result: AttemptResult
  info: PartialInfo
  /** Teil của đề (thứ tự, tên); trống thì xếp theo dữ liệu lượt dừng. */
  teile: FullTeil[]
  /** Mở xem lại một Teil đã có điểm (phân tích từng câu). */
  onOpen: (key: string) => void
  examHref: string | null
  hubHref: string
}

/**
 * Kết quả lượt thi thử DỪNG GIỮA CHỪNG (owner chốt 07/11/2026). Không tổng điểm, không Đỗ/Chưa đỗ: chỉ
 * điểm các Teil đã làm (đã trả lời ≥ 1 câu; câu trống trong Teil đó tính 0). Viết dở không chấm. Teil
 * chưa làm ghi "không tính".
 */
export function PartialSummary({ result, info, teile, onOpen, examHref, hubHref }: Props) {
  const t = useTranslations('v2.student.fullExam.partial')
  const tp = useTranslations('v2.student.practice')
  const fmtd = useFmt()
  const examTitle = result.exam_title ?? result.title ?? ''
  const when = result.finished_at ?? result.started_at
  const order = teile.length > 0 ? teile.map((x) => x.key) : info.teile.map((x) => x.key)
  const byKey = new Map(info.teile.map((x) => [x.key, x]))
  const sectionOf = (key: string) => key.slice(0, key.lastIndexOf('-'))
  const noOf = (key: string) => Number(key.slice(key.lastIndexOf('-') + 1)) || 1
  const nameOf = (key: string) =>
    sectionOf(key) === 'SCHREIBEN' ? 'Schreiben' : `${tp(`sectionDe.${sectionOf(key)}`)} · Teil ${noOf(key)}`

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-7 px-4 py-6 sm:px-6">
      <header className="min-w-0">
        <p className="ga-ui inline-flex items-center gap-1.5 text-ga-eyebrow uppercase text-ga-muted">
          <FileText size={14} aria-hidden /> {examTitle}
          {when && <> · {fmtd.date(when)}</>}
        </p>
        <h1 className="mt-1 break-words font-ga-display text-ga-h1 text-ga-ink">{t('title')}</h1>
        <p className="ga-ui mt-2 max-w-[640px] text-ga-body text-ga-muted">
          {info.reason === 'EXPIRED' ? t('leadExpired') : t('leadStopped')}
        </p>
      </header>

      <section aria-labelledby="partial-teile">
        <h2 id="partial-teile" className="mb-3 font-ga-display text-ga-h2 text-ga-ink">
          {t('doneOf', { done: info.teileDone, total: info.teileTotal })}
        </h2>
        <ul className="border-t border-ga-line">
          {order.map((key) => {
            const x = byKey.get(key)
            const status = x?.status ?? 'NOT_ATTEMPTED'
            const icon = SECTION_ICON[sectionOf(key)] ?? FileText
            const line =
              status === 'SCORED'
                ? t('rowScored', { answered: x?.answered ?? 0, total: x?.total ?? 0 })
                : status === 'WRITTEN_NOT_GRADED'
                  ? t('rowWritten')
                  : t('rowSkipped')
            const content = (
              <>
                <Glyph icon={icon} />
                <span className="min-w-0">
                  <b lang="de" className="block truncate text-ga-body font-semibold text-ga-ink">{nameOf(key)}</b>
                  <span className="block truncate text-ga-small text-ga-muted">{line}</span>
                </span>
                <span className="text-right font-ga-display text-ga-h3 font-bold tabular-nums text-ga-ink">
                  {status === 'SCORED' && x?.score != null && x.max != null ? `${fmt(x.score)}/${fmt(x.max)}` : '–'}
                </span>
              </>
            )
            return (
              <li key={key}>
                {status === 'SCORED' ? (
                  <button
                    type="button"
                    onClick={() => onOpen(key)}
                    className="group ga-ui grid min-h-16 w-full grid-cols-[36px_minmax(0,1fr)_72px_18px] items-center gap-3.5 border-b border-ga-line px-1 py-2.5 text-left transition-colors duration-150 hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ga-focus"
                  >
                    {content}
                    <ChevronRight size={16} className="text-ga-subtle transition-transform duration-150 group-hover:translate-x-[3px]" aria-hidden />
                  </button>
                ) : (
                  <div className="ga-ui grid min-h-16 grid-cols-[36px_minmax(0,1fr)_72px_18px] items-center gap-3.5 border-b border-ga-line px-1 py-2.5 opacity-70">
                    {content}
                    <span aria-hidden />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        <p className="ga-ui mt-2 text-ga-small text-ga-muted">{t('note')}</p>
      </section>

      <div className="flex flex-wrap gap-2.5">
        {examHref && (
          <Link
            href={examHref}
            className="ga-ui inline-flex min-h-11 items-center gap-1.5 rounded-ga-touch bg-ga-yellow px-4 text-ga-body font-semibold text-ga-ink hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
          >
            <RotateCcw size={16} aria-hidden /> {t('again')}
          </Link>
        )}
        <Link
          href={hubHref}
          className="ga-ui inline-flex min-h-11 items-center gap-1.5 rounded-ga-touch border-[1.5px] border-ga-line-strong bg-ga-card px-4 text-ga-body font-semibold text-ga-ink hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
        >
          {t('toHub')} <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    </div>
  )
}
