'use client'

import * as React from 'react'
import { GaShell } from '@/components/ui-v2'
import type { RoleId } from '@/components/ui-v2'
import { useUserStore } from '@/stores/useUserStore'

/**
 * RoleShell — wraps a SHARED /v2 screen (notifications · profile · payment) in the
 * viewer's own role shell (sidebar + accent), resolved client-side from the user
 * store. Org membership wins, then ADMIN, then TEACHER, else STUDENT.
 */
export function RoleShell({ children }: { children: React.ReactNode }) {
  const roles = useUserStore((s) => s.user?.roles)
  const orgRole = useUserStore((s) => s.orgRole)

  const has = (r: string) => roles?.some((x) => x.toUpperCase() === r) ?? false
  const role: RoleId = orgRole ? 'org' : has('ADMIN') ? 'admin' : has('TEACHER') ? 'teacher' : 'student'

  return <GaShell role={role}>{children}</GaShell>
}
