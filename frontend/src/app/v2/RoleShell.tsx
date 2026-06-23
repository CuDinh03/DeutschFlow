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
 * middleware and the role layouts trust — NOT the Zustand user store (its `user`
 * is often null and `orgRole` stale).
 *
 * A user may belong to MORE THAN ONE area (a TEACHER who owns an org has both a
 * /v2/teacher and a /v2/org shell). The entry point (the GaTopBar bell) passes
 * `?from=<area>` so a shared screen stays in the SAME shell the user came from —
 * otherwise a teacher clicking the bell from /v2/teacher would jump to the org
 * shell. `from` is honoured only when it is an area the user is actually entitled
 * to; otherwise we fall back to their primary area (mirrors the login router).
 *
 * Resolved on the client (cookies aren't readable during SSR), so render is held
 * until the role is known — avoids flashing the wrong sidebar.
 */
export function RoleShell({ children }: { children: React.ReactNode }) {
  const [role, setRole] = React.useState<RoleId | null>(null)

  React.useEffect(() => {
    const authRole = getAuthRole() // ADMIN | OWNER | MANAGER | TEACHER | STUDENT (cookie → JWT → default)
    const orgRole = getOrgRole() // OWNER | MANAGER | TEACHER | STUDENT | '' (cookie → JWT)

    // Org leads come in two flavours (mirrors the middleware's v2RoleHome):
    //  • First-class platform role (2026-06-22 / V235): authRole is OWNER or MANAGER. A centre lead is
    //    its OWN global identity, strictly administrative with NO teacher access → org shell only.
    //  • Legacy: a global TEACHER who owns/manages an org (token minted before the rename, until it
    //    expires) still carries an OWNER/MANAGER/ADMIN orgRole claim and keeps BOTH shells.
    //    'ADMIN' is the legacy alias for MANAGER on those pre-rename tokens.
    const isPlatformOrgLead = authRole === 'OWNER' || authRole === 'MANAGER'
    const isLegacyOrgLead =
      authRole === 'TEACHER' && (orgRole === 'OWNER' || orgRole === 'MANAGER' || orgRole === 'ADMIN')

    // Areas this user may legitimately see, primary first (mirrors the login router).
    const allowed: RoleId[] =
      authRole === 'ADMIN'
        ? ['admin']
        : isPlatformOrgLead
          ? ['org']
          : isLegacyOrgLead
            ? ['org', 'teacher']
            : authRole === 'TEACHER'
              ? ['teacher']
              : ['student']

    const from = new URLSearchParams(window.location.search).get('from') as RoleId | null
    setRole(from && allowed.includes(from) ? from : allowed[0])
  }, [])

  if (role === null) return null
  return <GaShell role={role}>{children}</GaShell>
}
