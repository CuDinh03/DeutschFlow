'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { notePageView } from '@/lib/pageTrail'

/** Ghi trang trước trong tab cho form góp ý (xem `lib/pageTrail.ts`). Không hiển thị gì. */
export function PageTrailRecorder(): null {
  const pathname = usePathname()
  useEffect(() => {
    if (pathname) notePageView(pathname)
  }, [pathname])
  return null
}
