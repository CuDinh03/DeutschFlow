import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * AdStat strip — the admin KPI band (pattern-setter: 70-admin-users / 77-admin-orgs).
 * 4-up grid, each cell = 5px accent top-bar + faint `{color}0e` tint + GaCap label +
 * Newsreader-36 value + optional sub (red-dot alert). Pass HEX colors so the tint resolves.
 */
export interface AdStatCell {
  label: string
  value: React.ReactNode
  /** HEX accent (e.g. '#1E9E61') — drives top-bar, value colour and the 0e tint. */
  color: string
  sub?: React.ReactNode
  alert?: boolean
}

function AdStatItem({ label, value, color, sub, alert }: AdStatCell) {
  return (
    <div className="relative border-l border-ga-border px-6 py-[22px]" style={{ background: `${color}0e` }}>
      <div className="absolute inset-x-0 top-0 h-[5px]" style={{ background: color }} />
      <p className="ga-ui mb-[10px] text-[11px] font-semibold uppercase tracking-[0.16em] text-ga-muted">
        {label}
      </p>
      <p className="font-ga-display text-[36px] font-medium leading-none" style={{ color }}>
        {value}
      </p>
      {sub && (
        <p
          className={cn(
            'ga-ui mt-2 flex items-center gap-1.5 text-[13px]',
            alert ? 'text-ga-red' : 'text-ga-muted',
          )}
        >
          {alert && <span className="inline-block h-1.5 w-1.5 rounded-full bg-ga-red" />}
          {sub}
        </p>
      )}
    </div>
  )
}

export function AdStatStrip({ cells, className }: { cells: AdStatCell[]; className?: string }) {
  return (
    <div
      className={cn('grid border border-ga-border border-l-0', className)}
      style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
    >
      {cells.map((c, i) => (
        <AdStatItem key={i} {...c} />
      ))}
    </div>
  )
}
