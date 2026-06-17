import * as React from 'react'
import { cn } from '@/lib/utils'
import { GaSidebar } from './GaSidebar'
import { ROLE_NAV, type RoleId } from './nav'

/**
 * GaShell — app frame (sidebar + content). Manifest: variants student|teacher|admin|org.
 * Accent comes from the `data-role` on the wrapper (see galerie.css). Server component;
 * the interactive nav lives in GaSidebar (client).
 */
export interface GaShellProps {
  role: RoleId
  children: React.ReactNode
  className?: string
}

export function GaShell({ role, children, className }: GaShellProps) {
  return (
    <div data-role={role} className={cn('flex min-h-screen bg-ga-surface text-ga-ink', className)}>
      <GaSidebar nav={ROLE_NAV[role]} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
