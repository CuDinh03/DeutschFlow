'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { adminFeedbackApi } from '@/lib/feedbackApi'
import type { NavItem } from './nav'

type CountKey = NonNullable<NavItem['countKey']>

const LOADERS: Record<CountKey, () => Promise<number>> = {
  adminFeedbackNew: () => adminFeedbackApi.unreadCount().then((r) => r.data.count),
}

/**
 * Số đếm cạnh một mục menu (FBK-15). Tải lại mỗi lần đổi trang để vừa đọc xong góp ý thì số giảm theo.
 * Ẩn khi 0 hoặc khi tải lỗi — một con số sai còn tệ hơn không có số.
 */
export function NavCount({ countKey, active }: { countKey: CountKey; active: boolean }) {
  const pathname = usePathname()
  const [count, setCount] = React.useState(0)

  React.useEffect(() => {
    let alive = true
    LOADERS[countKey]()
      .then((n) => { if (alive) setCount(n) })
      .catch(() => { if (alive) setCount(0) })
    return () => { alive = false }
  }, [countKey, pathname])

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
