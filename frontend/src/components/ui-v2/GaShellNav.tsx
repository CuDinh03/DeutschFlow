'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { GaIcon } from './GaIcon'

/**
 * GaShellNav — trạng thái mở/đóng ngăn kéo sidebar trên mobile, chia sẻ giữa nút
 * hamburger (trong GaTopBar) và bản thân ngăn kéo (GaSidebar). Hai thành phần này
 * nằm ở hai nhánh cây khác nhau dưới GaShell (server component) nên phải dùng
 * context — GaShell chỉ cần bọc phần thân trong `GaShellNavProvider`.
 *
 * Ở lg+ ngăn kéo trở thành rail tĩnh nên trạng thái này không còn tác dụng.
 */
interface GaShellNavCtx {
  open: boolean
  setOpen: (open: boolean) => void
}

const GaShellNavContext = React.createContext<GaShellNavCtx | null>(null)

export function GaShellNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const value = React.useMemo(() => ({ open, setOpen }), [open])
  return <GaShellNavContext.Provider value={value}>{children}</GaShellNavContext.Provider>
}

export function useGaShellNav(): GaShellNavCtx {
  const ctx = React.useContext(GaShellNavContext)
  if (!ctx) throw new Error('useGaShellNav phải nằm trong <GaShellNavProvider>')
  return ctx
}

/**
 * GaSidebarToggle — nút hamburger mở ngăn kéo điều hướng. Chỉ hiện dưới lg (chỗ
 * rail còn là ngăn kéo); từ lg trở lên rail đã tĩnh nên nút ẩn.
 */
export function GaSidebarToggle() {
  const t = useTranslations('v2.shell')
  const { open, setOpen } = useGaShellNav()
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={t('openNavAria')}
      aria-expanded={open}
      aria-controls="ga-shell-sidebar"
      className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-ga border border-ga-line text-ga-muted transition-colors hover:bg-ga-surface hover:text-ga-ink lg:hidden"
    >
      <GaIcon name="menu" size={20} />
    </button>
  )
}
