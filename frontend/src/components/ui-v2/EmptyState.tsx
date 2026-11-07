import * as React from 'react'
import { cn } from '@/lib/utils'
import { GaGlyph, type GaGlyphIcon } from './GaGlyph'

/** EmptyState — empty list/screen + optional CTA. Manifest: variants invite|neutral. */
export interface EmptyStateProps {
  variant?: 'invite' | 'neutral'
  /** Tên trong bảng `GaIcon` hoặc component icon (Lucide / glyph tự vẽ). */
  icon?: string | GaGlyphIcon
  title: string
  description?: string
  /** CTA slot (e.g. a <GaBtn>). */
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  variant = 'neutral',
  icon = 'inbox',
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-4 py-10 text-center lg:px-6 lg:py-14',
        variant === 'invite' && 'rounded-ga border border-dashed border-ga-line bg-ga-card',
        className,
      )}
    >
      {/* Ô nhận diện chung (GaGlyph lg): vuông bo rounded-ga như mọi ô icon, không còn tròn theo màu vai trò
          (vàng nhạt trên vàng của học viên gần như không thấy). */}
      <GaGlyph
        size="lg"
        tone={variant === 'invite' ? 'navy' : 'plain'}
        {...(typeof icon === 'string' ? { name: icon } : { icon })}
      />
      <div className="space-y-1">
        <p className="font-ga-display text-[18px] font-medium text-ga-ink">{title}</p>
        {description && (
          <p className="ga-ui mx-auto max-w-sm text-[13px] text-ga-muted">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
