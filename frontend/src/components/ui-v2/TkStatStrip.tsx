import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * TkStatStrip — teacher/org KPI band (proto TkStatStrip): 3px accent top-bar,
 * Newsreader-32 value (vs admin AdStat 5px / 36), optional delta + alert sub.
 * Value colour defaults to the item colour or the role accent.
 */
export interface TkStatItem {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  /** Accent colour (top-bar + value). Defaults to the role `--ga-accent`. */
  color?: string
  alert?: boolean
  /** e.g. "▲4.1" — rendered green (up) / red (down) beside the value. */
  delta?: string
  deltaUp?: boolean
}

export function TkStatStrip({ items, className }: { items: TkStatItem[]; className?: string }) {
  return (
    <div
      className={cn('grid border border-ga-line border-l-0', className)}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((it, i) => {
        const color = it.color ?? 'var(--ga-accent)'
        return (
          <div key={i} className="relative border-l border-ga-line bg-ga-card px-6 py-[22px]">
            <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: color }} />
            <p className="ga-ui mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-ga-muted">
              {it.label}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="font-ga-display text-[32px] font-medium leading-none" style={{ color }}>
                {it.value}
              </span>
              {it.delta && (
                <span
                  className="text-[12.5px] font-semibold"
                  style={{ color: it.deltaUp ? 'var(--ga-green)' : 'var(--ga-red)' }}
                >
                  {it.delta}
                </span>
              )}
            </div>
            {it.sub && (
              <p
                className={cn(
                  'ga-ui mt-2 flex items-center gap-1.5 text-[12.5px]',
                  it.alert ? 'text-ga-red' : 'text-ga-muted',
                )}
              >
                {it.alert && <span className="inline-block h-1.5 w-1.5 rounded-full bg-ga-red" />}
                {it.sub}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
