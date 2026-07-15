"use client"

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useAuthRecoveryStore } from '@/stores/useAuthRecoveryStore'
import { clearTokens } from '@/lib/authSession'
import { cn } from '@/components/ui/utils'

/** Hai bề mặt đăng nhập của v2 — đá chúng về /v2/login là tự đá vào chính nó. */
const V2_LOGIN_ROUTES = new Set(['/v2/login', '/v2/register'])

/**
 * `trailingSlash: true` (next.config.mjs) ⇒ pathname luôn tận cùng bằng "/" (`/v2/login/`), nên mọi
 * so sánh CHÍNH XÁC phải chạy trên dạng đã bỏ dấu "/" cuối, không thì lặng lẽ không bao giờ khớp —
 * đúng cái bẫy mà `routeKey()` bên `src/middleware.ts` sinh ra để tránh.
 */
function routeKey(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/'
}

/**
 * Dialog này mount TOÀN CỤC ở root layout nên chạy trên cả cây v2. Trước đây danh sách chỉ có prefix
 * v1, nên ở giữa một trang /v2/* phiên hết hạn chỉ xoá token rồi ĐỨNG YÊN — người dùng ngồi lại trên
 * màn hình đã chết, không có gì đưa họ đi đăng nhập lại.
 */
function requiresLogin(pathname: string): boolean {
  if (pathname.startsWith('/v2/')) return !V2_LOGIN_ROUTES.has(routeKey(pathname))
  return pathname.startsWith('/dashboard') || pathname.startsWith('/speaking') || pathname.startsWith('/student') || pathname.startsWith('/teacher') || pathname.startsWith('/admin') || pathname.startsWith('/roadmap') || pathname.startsWith('/news') || pathname.startsWith('/onboarding')
}

export function AuthRecoveryDialog() {
  const router = useRouter()
  const pathname = usePathname() || '/'
  const { state, message, resolve } = useAuthRecoveryStore()
  const open = state === 'needs_reauth'
  const [acknowledged, setAcknowledged] = useState(false)

  useEffect(() => {
    if (!open) setAcknowledged(false)
  }, [open])

  const description = useMemo(
    () => message || 'Phiên đăng nhập của bạn đã hết hạn hoặc không thể tự làm mới. Vui lòng đăng nhập lại để tiếp tục.',
    [message],
  )

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className={cn('max-w-md')}>
        <AlertDialogHeader>
          <AlertDialogTitle>Phiên đăng nhập đã hết hạn</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            onClick={() => {
              if (acknowledged) return
              setAcknowledged(true)
              clearTokens()
              resolve()
              if (requiresLogin(pathname)) {
                // Kèm `?next=` để giữ deep-link, cùng quy ước middleware tự đặt khi đá người chưa
                // đăng nhập ra. safeNext() bên đó chỉ nhận path nội bộ — pathname luôn thoả.
                router.replace(`/v2/login?next=${encodeURIComponent(pathname)}`)
              }
            }}
          >
            OK
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
