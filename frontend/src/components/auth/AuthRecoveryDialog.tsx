"use client"

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useAuthRecoveryStore } from '@/stores/useAuthRecoveryStore'
import { clearTokens } from '@/lib/authSession'
import { cn } from '@/components/ui/utils'

function requiresLogin(pathname: string): boolean {
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
                router.replace('/login')
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
