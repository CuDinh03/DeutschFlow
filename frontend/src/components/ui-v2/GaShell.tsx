import * as React from 'react'
import { cn } from '@/lib/utils'
import { GaSidebar } from './GaSidebar'
import { GaTopBar } from './GaTopBar'
import { GaShellNavProvider } from './GaShellNav'
import { GaRoleProvider } from './gaScope'
import { GaLocalNav } from './GaLocalNav'
import { GaBottomNav } from './GaBottomNav'
import { ROLE_NAV, type RoleId } from './nav'

/**
 * GaShell — app frame (sidebar + top bar + scrolling content). Manifest variants
 * student|teacher|admin|org; accent comes from `data-role` (see galerie.css). Matches the proto
 * shell (proto-layout.jsx:246): fixed-height row → fixed sidebar + [GaTopBar + scrollable main].
 * Pages fill `main` (h-full / min-h-full at their root); main is the single scroll container.
 * Server component; interactive nav lives in GaSidebar (client).
 *
 * Dưới lg, GaSidebar chuyển thành ngăn kéo trượt (fixed, ngoài luồng flex) do một
 * nút hamburger trong GaTopBar điều khiển — trạng thái chia sẻ qua GaShellNavProvider.
 * Từ lg trở lên rail lại tĩnh (248px) như thiết kế gốc, không đổi một pixel.
 */
export interface GaShellProps {
  role: RoleId
  children: React.ReactNode
  className?: string
}

export function GaShell({ role, children, className }: GaShellProps) {
  return (
    // GaRoleProvider (Gate 0 remediation #1): khai role MỘT lần cho cả cây — portal components
    // (TkModal, GaPopover/GaTooltip/GaSelect) tự nhận đúng data-role, page không phải truyền tay.
    <GaRoleProvider role={role}>
    <GaShellNavProvider>
      <div
        data-role={role}
        // h-[100dvh] dưới lg: trên Safari iOS `h-screen` (100vh) TÍNH CẢ phần bị thanh công cụ
        // động che, nên đáy của <main> nằm khuất dưới thanh địa chỉ — người dùng không chạm tới
        // được hàng nút cuối trang. dvh đo đúng vùng nhìn thấy. Từ lg trả lại h-screen y như cũ.
        className={cn('flex h-[100dvh] overflow-hidden bg-ga-surface text-ga-ink lg:h-screen', className)}
      >
        <GaSidebar nav={ROLE_NAV[role]} />
        <div className="flex min-w-0 flex-1 flex-col">
          <GaTopBar role={role} />
          {/* Điều hướng cấp 2 của area (Wave 1 / S-01) — chrome của shell nên mọi màn đều có
              đường vào đầy đủ mà không phải sửa page. Tự ẩn khi area không có local nav. */}
          <GaLocalNav role={role} />
          <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
          {/* Bottom nav web <768px (S-13). Là anh em flex của <main>, không phải overlay
              `fixed`, nên không cần padding bù và không bao giờ che nội dung. */}
          <GaBottomNav role={role} />
        </div>
      </div>
    </GaShellNavProvider>
    </GaRoleProvider>
  )
}
