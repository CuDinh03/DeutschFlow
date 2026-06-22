'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { getOrgRole } from '@/lib/authSession'
import { LoadingState } from '@/components/ui-v2'

/**
 * Owner-only client guard for org sub-pages (Tài chính, Gói & Giấy phép).
 *
 * MANAGER (nhân sự) is an org admin for day-to-day ops — mời giáo viên, import/xoá học viên, xem
 * lớp · học viên · phân tích — but NOT for finance/billing: those are OWNER (giám đốc) only. The
 * backend enforces it (OrgGuard.assertOrgFinance = OWNER); this guard is the UX layer — it hides
 * the page from a MANAGER who reaches the URL directly and bounces them to the org dashboard.
 *
 * Runs client-side so it still applies on CloudFront-cached /v2 routes where middleware does NOT
 * execute (see middleware.ts CSP note). Renders a neutral loading state until ownership is
 * confirmed, so protected content never flashes for a non-owner.
 */
export function OrgOwnerOnly({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [state, setState] = React.useState<'checking' | 'owner'>('checking')

  React.useEffect(() => {
    if (getOrgRole() === 'OWNER') {
      setState('owner')
    } else {
      router.replace('/v2/org')
    }
  }, [router])

  if (state !== 'owner') return <LoadingState label="Đang kiểm tra quyền…" />
  return <>{children}</>
}
