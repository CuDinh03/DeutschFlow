import * as React from 'react'
import { GaShell } from '@/components/ui-v2'
import { RoleAreaGuard } from '../RoleAreaGuard'

/** /v2/admin — admin role shell (sidebar + navy roleAccent via data-role). */
export default function V2AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleAreaGuard area="admin">
      <GaShell role="admin">{children}</GaShell>
    </RoleAreaGuard>
  )
}
