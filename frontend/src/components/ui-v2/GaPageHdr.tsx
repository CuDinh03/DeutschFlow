import * as React from 'react'
import { cn } from '@/lib/utils'
import { GaCap } from './GaCap'

/**
 * GaPageHdr — page title band (h1 display) + subtitle + right action slot.
 * Manifest: variants plain|with-accent|with-right. Design (70-admin-users):
 * card band + bottom border + optional 6px left role-accent bar. Pad = token pageHeaderPad.
 */
export interface GaPageHdrProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Eyebrow caption (with-accent). */
  eyebrow?: React.ReactNode
  /** Right-aligned actions (with-right). */
  right?: React.ReactNode
  /** 6px left role-accent bar (with-accent variant). */
  accent?: boolean
  className?: string
}

export function GaPageHdr({ title, subtitle, eyebrow, right, accent = false, className }: GaPageHdrProps) {
  return (
    <header
      className={cn(
        // flex-wrap: on narrow widths the right-action slot drops below the title
        // instead of crushing it (fixes class-detail / tc-checklist header cramping).
        'relative flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b px-[52px] pb-[26px] pt-9',
        className,
      )}
      style={{
        background: 'var(--ga-hdr-bg)',
        borderBottomColor: 'var(--ga-hdr-line)',
      }}
    >
      {accent && <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-ga-accent" />}
      <div className="min-w-0">
        {eyebrow && <GaCap className="mb-2">{eyebrow}</GaCap>}
        <h1 className="font-ga-display text-[36px] font-medium leading-[1.15] tracking-[-0.015em] text-ga-ink">
          {title}
        </h1>
        {subtitle && <p className="ga-ui mt-2 max-w-2xl text-[14.5px] text-ga-muted">{subtitle}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2.5">{right}</div>}
    </header>
  )
}
