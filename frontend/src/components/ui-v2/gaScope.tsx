'use client'

import * as React from 'react'
import type { RoleId } from './nav'

/**
 * PORTAL SCOPE CONTRACT (Wave 0, W0-C4).
 *
 * Radix portal (Popover/Tooltip/Select/Dialog) render nội dung trên `document.body` — NGOÀI
 * subtree `.ga-scope` — nên mọi token `--ga-*` và role accent sẽ KHÔNG resolve nếu không xử lý.
 * Hợp đồng: nội dung portal phải TỰ mang class `ga-scope` VÀ đúng `data-role` trên chính nó
 * (galerie.css đã có compound selector `.ga-scope[data-role=…]` cho trường hợp này).
 *
 * Role được xác định theo thứ tự: prop `gaRole` tường minh → tự dò từ DOM (phần tử trigger
 * nằm trong cây, `closest('[data-role]')`). Không promote token lên `:root` (legacy còn sống).
 */

/**
 * Shell role context (Gate 0 remediation #1): GaShell khai vai trò MỘT lần cho cả cây —
 * mọi portal component (TkModal, Ga*Content) đọc từ đây nên không phải sửa hàng loạt page
 * và không cần DOM lookup. Ưu tiên: prop `gaRole` tường minh > shell context > DOM detect.
 */
const GaShellRoleContext = React.createContext<RoleId | undefined>(undefined)

export function GaRoleProvider({ role, children }: { role: RoleId; children: React.ReactNode }) {
  return <GaShellRoleContext.Provider value={role}>{children}</GaShellRoleContext.Provider>
}

/** Vai trò của shell hiện hành (undefined khi render ngoài GaShell — vd trang public). */
export function useGaShellRole(): RoleId | undefined {
  return React.useContext(GaShellRoleContext)
}

interface GaPortalRoleCtx {
  role: RoleId | undefined
  report: (role: RoleId | undefined) => void
}

const GaPortalRoleContext = React.createContext<GaPortalRoleCtx | null>(null)

export function GaPortalRoleProvider({
  gaRole,
  children,
}: {
  gaRole?: RoleId
  children: React.ReactNode
}) {
  const shellRole = useGaShellRole()
  const [detected, setDetected] = React.useState<RoleId | undefined>(undefined)
  const report = React.useCallback((role: RoleId | undefined) => {
    if (role) setDetected((prev) => prev ?? role)
  }, [])
  const value = React.useMemo(
    () => ({ role: gaRole ?? shellRole ?? detected, report }),
    [gaRole, shellRole, detected, report],
  )
  return <GaPortalRoleContext.Provider value={value}>{children}</GaPortalRoleContext.Provider>
}

/** Role hiện hành cho nội dung portal (đọc trong Ga*Content). */
export function useGaPortalRole(): RoleId | undefined {
  return React.useContext(GaPortalRoleContext)?.role
}

const VALID_ROLES: ReadonlySet<string> = new Set(['student', 'teacher', 'admin', 'org'])

/**
 * Callback-ref gắn vào phần tử trigger (nằm TRONG cây DOM của app) để dò `data-role` gần nhất
 * và báo về provider. Ghép được với ref khác qua `composeRefs`.
 */
export function useGaRoleDetector(): (node: HTMLElement | null) => void {
  const ctx = React.useContext(GaPortalRoleContext)
  return React.useCallback(
    (node: HTMLElement | null) => {
      if (!node || !ctx) return
      const found = node.closest('[data-role]')?.getAttribute('data-role') ?? undefined
      ctx.report(found && VALID_ROLES.has(found) ? (found as RoleId) : undefined)
    },
    [ctx],
  )
}

/** Ghép nhiều ref (callback/object) thành một callback-ref. */
export function composeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue
      if (typeof ref === 'function') ref(node)
      else (ref as React.MutableRefObject<T | null>).current = node
    }
  }
}

/**
 * Trigger contract (Gate 0 review): khi Ga*Trigger được dùng TRỰC TIẾP (không asChild),
 * Radix render <button> trần — không style → không focus indicator, không touch target.
 * Bộ class mặc định này bảo đảm focus-visible (`--ga-focus`) + ≥44px mobile cho trường hợp đó.
 * Khi asChild, phần tử con (GaBtn, button của màn…) tự chịu trách nhiệm theo contract của nó.
 */
export const GA_TRIGGER_DEFAULT_CLASSES =
  'inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-ga-touch text-ga-small font-medium text-ga-ink outline-none transition-colors hover:bg-ga-surface focus-visible:ring-2 focus-visible:ring-ga-focus disabled:pointer-events-none disabled:opacity-50 lg:min-h-0 lg:min-w-0'
