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
  /** Per-screen accent override (6-digit hex, e.g. '#2F6FC9'). Colors the left bar + a soft
   *  header tint, matching the prototype's per-section accent (`${hex}12` bg + `${hex}33` border). */
  accentColor?: string
  className?: string
}

export function GaPageHdr({ title, subtitle, eyebrow, right, accent = false, accentColor, className }: GaPageHdrProps) {
  return (
    <header
      className={cn(
        // flex-wrap: on narrow widths the right-action slot drops below the title
        // instead of crushing it (fixes class-detail / tc-checklist header cramping).
        'relative flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b',
        // Đệm trang hạ thang trên mobile (52px × 2 ăn hết 104px của khổ 390px); lg trả lại nguyên bản.
        'px-4 pb-5 pt-6 sm:px-8 lg:px-[52px] lg:pb-[26px] lg:pt-9',
        className,
      )}
      style={
        accentColor
          ? { background: `${accentColor}12`, borderBottomColor: `${accentColor}33` }
          : { background: 'var(--ga-hdr-bg)', borderBottomColor: 'var(--ga-hdr-line)' }
      }
    >
      {(accent || accentColor) && (
        <span
          aria-hidden
          className={cn('absolute inset-y-0 left-0 w-1.5', !accentColor && 'bg-ga-accent')}
          style={accentColor ? { background: accentColor } : undefined}
        />
      )}
      <div className="min-w-0">
        {eyebrow && <GaCap className="mb-2">{eyebrow}</GaCap>}
        <h1 className="font-ga-display text-[24px] font-medium leading-[1.15] tracking-[-0.015em] text-ga-ink sm:text-[28px] lg:text-[36px]">
          {title}
        </h1>
        {subtitle && <p className="ga-ui mt-2 max-w-2xl text-[14.5px] text-ga-muted">{subtitle}</p>}
      </div>
      {right && (
        <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2.5 lg:max-w-none lg:flex-nowrap">
          {right}
        </div>
      )}
    </header>
  )
}
