import * as React from 'react'
import { cn } from '@/lib/utils'
import { GaSidebar } from './GaSidebar'
import { GaTopBar } from './GaTopBar'
import { ROLE_NAV, type RoleId } from './nav'

/**
 * GaShell — app frame (sidebar + top bar + scrolling content). Manifest variants
 * student|teacher|admin|org; accent comes from `data-role` (see galerie.css). Matches the proto
 * shell (proto-layout.jsx:246): fixed-height row → fixed sidebar + [GaTopBar + scrollable main].
 * Pages fill `main` (h-full / min-h-full at their root); main is the single scroll container.
 * Server component; interactive nav lives in GaSidebar (client).
 */
export interface GaShellProps {
  role: RoleId
  children: React.ReactNode
  className?: string
}

export function GaShell({ role, children, className }: GaShellProps) {
  return (
    <div
      data-role={role}
      className={cn('flex h-screen overflow-hidden bg-ga-surface text-ga-ink', className)}
    >
      <GaSidebar nav={ROLE_NAV[role]} />
      <div className="flex min-w-0 flex-1 flex-col">
        <GaTopBar role={role} />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
