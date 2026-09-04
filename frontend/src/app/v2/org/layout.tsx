import * as React from 'react'
import { GaShell } from '@/components/ui-v2'
import { RoleAreaGuard } from '../RoleAreaGuard'

/** /v2/org — organization role shell (sidebar + teal roleAccent via data-role). */
export default function V2OrgLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleAreaGuard area="org">
      <GaShell role="org">{children}</GaShell>
    </RoleAreaGuard>
  )
}
