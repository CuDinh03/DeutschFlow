'use client'

import { useTranslations } from 'next-intl'
import { CircleCheck, CircleDashed, Lightbulb, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Diagnosis } from './marksModel'

/**
 * "Bạn tìm bằng chứng thế nào" — một dòng sau khi kiểm tra, so đoạn học viên đã đánh dấu với vị trí
 * đáp án; câu sai thì thêm gợi ý: tìm đúng đoạn mà vẫn sai ⇒ đọc kỹ câu; chưa tìm ra ⇒ luyện dò từ khoá.
 */
export function MarkDiagnosis({
  diagnosis,
  where,
  mine,
  isCorrect,
}: {
  diagnosis: Diagnosis
  /** Vị trí đáp án, ví dụ "dòng 6–7". */
  where: string
  /** Vị trí các đoạn học viên đã gắn vào câu (khi lệch). */
  mine: string
  isCorrect: boolean
}) {
  const t = useTranslations('v2.student.practice.marks.diag')
  const { kind } = diagnosis
  const Icon = kind === 'found' ? CircleCheck : kind === 'none' ? CircleDashed : TriangleAlert
  const found = kind === 'found' || kind === 'untagged'
  return (
    <section className="ga-ui mb-2.5 rounded-ga-touch border border-ga-line bg-ga-bg px-3.5 py-3 text-ga-body leading-relaxed">
      <p className="text-ga-caption font-semibold uppercase tracking-wide text-ga-muted">{t('title')}</p>
      <p className={cn('mt-1 flex items-start gap-2', kind === 'found' ? 'text-ga-green' : kind === 'none' ? 'text-ga-muted' : 'text-ga-warning')}>
        <Icon size={16} className="mt-0.5 shrink-0" aria-hidden />
        <span className="text-ga-ink">
          {kind === 'found' && t('found', { where })}
          {kind === 'offTarget' && t('offTarget', { mine, where })}
          {kind === 'untagged' && t('untagged', { where })}
          {kind === 'none' && t('none', { where })}
        </span>
      </p>
      {!isCorrect && (
        <p className="mt-1.5 flex items-start gap-2 text-ga-small text-ga-muted">
          <Lightbulb size={15} className="mt-0.5 shrink-0" aria-hidden />
          <span>{found ? t('tipFound') : t('tipMiss')}</span>
        </p>
      )}
    </section>
  )
}
