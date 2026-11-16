'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { adminFeedbackApi } from '@/lib/feedbackApi'
import { NAV_COUNT_REFRESH_EVENT } from '@/lib/navCountEvents'
import type { NavItem } from './nav'

type CountKey = NonNullable<NavItem['countKey']>

const LOADERS: Record<CountKey, () => Promise<number>> = {
  adminFeedbackNew: () => adminFeedbackApi.unreadCount().then((r) => r.data.count),
}

/**
 * Số đếm cạnh một mục menu (FBK-15). Tải lại mỗi lần đổi trang, và khi có `requestNavCountRefresh()` —
 * mở chi tiết góp ý không đổi đường dẫn, nên chỉ nghe đổi trang thì số "Góp ý" đứng nguyên sau khi đọc.
 * Ẩn khi 0 hoặc khi tải lỗi — một con số sai còn tệ hơn không có số.
 */
export function NavCount({ countKey, active }: { countKey: CountKey; active: boolean }) {
  const pathname = usePathname()
  const [count, setCount] = React.useState(0)
  const [refreshTick, setRefreshTick] = React.useState(0)

  React.useEffect(() => {
    const onRefresh = () => setRefreshTick((n) => n + 1)
    window.addEventListener(NAV_COUNT_REFRESH_EVENT, onRefresh)
    return () => window.removeEventListener(NAV_COUNT_REFRESH_EVENT, onRefresh)
  }, [])

  React.useEffect(() => {
    let alive = true
    LOADERS[countKey]()
      .then((n) => { if (alive) setCount(n) })
      .catch(() => { if (alive) setCount(0) })
    return () => { alive = false }
  }, [countKey, pathname, refreshTick])

  if (count <= 0) return null
  return (
    <span
      className={
        'ml-auto shrink-0 rounded-ga-pill px-1.5 text-ga-caption font-semibold leading-5 tabular-nums ' +
        (active ? 'bg-ga-accent text-ga-accent-ink' : 'bg-ga-navy-soft text-ga-navy')
      }
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
