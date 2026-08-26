'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import api from '@/lib/api'

/**
 * TeacherPendingPill — top-bar pill showing the live count of submissions awaiting grading.
 * Source = GET /v2/teacher/dashboard/summary (field `pendingReviewCount`), the same endpoint the
 * teacher dashboard already uses. No fabricated number: while loading or on error it falls back to
 * the honest role chip; n=0 shows "Đã chấm hết"; n>0 links to the grading center.
 */
export function TeacherPendingPill() {
  const t = useTranslations('v2.ui')
  const [pending, setPending] = React.useState<number | null>(null)

  React.useEffect(() => {
    let alive = true
    api
      .get('/v2/teacher/dashboard/summary')
      .then((res) => {
        if (!alive) return
        const n = Number((res.data as { pendingReviewCount?: number })?.pendingReviewCount)
        setPending(Number.isFinite(n) ? n : null)
      })
      .catch(() => {
        if (alive) setPending(null)
      })
    return () => {
      alive = false
    }
  }, [])

  // Pill hiện từ md (768 < lg) nên vẫn thuộc vùng chạm tay → min-h 44px dưới lg (Gate 0 review).
  const pillBase = 'inline-flex min-h-11 items-center whitespace-nowrap rounded-ga px-3 py-[7px] text-[12.5px] font-semibold lg:min-h-0'

  if (pending === null) {
    return <span className={`${pillBase} bg-ga-accent-soft text-ga-accent`}>{t('roleChipTeacher')}</span>
  }

  if (pending === 0) {
    return <span className={`${pillBase} bg-ga-surface text-ga-muted`}>{t('gradedAll')}</span>
  }

  return (
    <Link
      href="/v2/teacher/grading"
      className={`${pillBase} bg-ga-accent-soft text-ga-accent transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ga-bg`}
    >
      {t('pendingGrading', { count: pending })}
    </Link>
  )
}
