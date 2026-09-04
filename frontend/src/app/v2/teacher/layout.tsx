import * as React from 'react'
import { GaShell } from '@/components/ui-v2'
import { RoleAreaGuard } from '../RoleAreaGuard'

/** /v2/teacher — teacher role shell (sidebar + violet roleAccent via data-role). */
export default function V2TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleAreaGuard area="teacher">
      <GaShell role="teacher">{children}</GaShell>
    </RoleAreaGuard>
  )
}
