'use client'

import * as React from 'react'
import { GaShell } from '@/components/ui-v2'
import type { RoleId } from '@/components/ui-v2'
import { getAuthRole, getOrgRole } from '@/lib/authSession'

/**
 * RoleShell — wraps a SHARED /v2 screen (notifications · profile · payment) in the
 * viewer's OWN role shell (sidebar + accent).
 *
 * Role is resolved from the auth cookies/JWT (authSession) — the same source the
 * middleware and the role layouts trust — NOT the Zustand user store. The store's
 * `user` is frequently unhydrated (null) and its `orgRole` can be stale across
 * logins, which is what made an ADMIN clicking the notification bell land on the
 * STUDENT shell.
 *
 * Precedence mirrors the login router (v2/login `switch`): global ADMIN → admin;
 * global TEACHER → org shell when they own/administer an org, else teacher;
 * otherwise student.
 *
 * Resolved on the client (cookies aren't readable during SSR), so render is held
 * until the role is known — avoids flashing the wrong sidebar.
 */
export function RoleShell({ children }: { children: React.ReactNode }) {
  const [role, setRole] = React.useState<RoleId | null>(null)

  React.useEffect(() => {
    const authRole = getAuthRole() // ADMIN | TEACHER | STUDENT (cookie → JWT → default)
    const orgRole = getOrgRole() // OWNER | ADMIN | TEACHER | STUDENT | '' (cookie → JWT)
    setRole(
      authRole === 'ADMIN'
        ? 'admin'
        : authRole === 'TEACHER'
          ? orgRole === 'OWNER' || orgRole === 'ADMIN'
            ? 'org'
            : 'teacher'
          : 'student',
    )
  }, [])

  if (role === null) return null
  return <GaShell role={role}>{children}</GaShell>
}
