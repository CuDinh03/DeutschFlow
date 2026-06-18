'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LoadingState } from '@/components/ui-v2'

// Tuition / học phí = the shared upgrade surface. Redirect to /v2/payment (single source).
export default function V2StudentTuitionPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/v2/payment')
  }, [router])
  return (
    <div className="grid min-h-full place-items-center">
      <div className="text-center">
        <LoadingState label="Đang chuyển tới trang nâng cấp…" />
        <Link href="/v2/payment" className="ga-ui text-[13px] font-semibold text-ga-accent underline">
          Bấm vào đây nếu không tự chuyển
        </Link>
      </div>
    </div>
  )
}
