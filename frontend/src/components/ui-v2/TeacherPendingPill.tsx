'use client'

import * as React from 'react'
import Link from 'next/link'
import api from '@/lib/api'

/**
 * TeacherPendingPill — top-bar pill showing the live count of submissions awaiting grading.
 * Source = GET /v2/teacher/dashboard/summary (field `pendingReviewCount`), the same endpoint the
 * teacher dashboard already uses. No fabricated number: while loading or on error it falls back to
 * the honest role chip; n=0 shows "Đã chấm hết"; n>0 links to the grading center.
 */
export function TeacherPendingPill() {
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

  if (pending === null) {
    return (
      <span className="whitespace-nowrap rounded-ga bg-ga-accent-soft px-3 py-[7px] text-[12.5px] font-semibold text-ga-accent">
        Khu vực giáo viên
      </span>
    )
  }

  if (pending === 0) {
    return (
      <span className="whitespace-nowrap rounded-ga bg-ga-surface px-3 py-[7px] text-[12.5px] font-semibold text-ga-muted">
        Đã chấm hết
      </span>
    )
  }

  return (
    <Link
      href="/v2/teacher/grading"
      className="whitespace-nowrap rounded-ga bg-ga-accent-soft px-3 py-[7px] text-[12.5px] font-semibold text-ga-accent transition-[filter] hover:brightness-95"
    >
      {pending} bài chờ chấm
    </Link>
  )
}
