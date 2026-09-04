import * as React from 'react'
import { GaShell } from '@/components/ui-v2'
import { RoleAreaGuard } from '../RoleAreaGuard'

/**
 * /v2/student — Galerie 2.0 student surface. Yellow accent (`data-role="student"`
 * already defined in galerie.css). Nav is SCOPED to the teacher-interaction screens
 * (my-classes · st-progress · tutor) for this cohort; the full student-daily nav
 * lands in P6.
 */
export default function V2StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleAreaGuard area="student">
      <GaShell role="student">{children}</GaShell>
    </RoleAreaGuard>
  )
}
