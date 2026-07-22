import * as React from 'react'
import { cn } from '@/lib/utils'
import { GaIcon } from './GaIcon'
import { GaBtn } from './GaBtn'

/** ErrorBanner — error + retry. Manifest: variants inline|page. */
export interface ErrorBannerProps {
  variant?: 'inline' | 'page'
  title?: string
  message?: string
  /** Retry handler; renders "Thử lại" when provided. */
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

export function ErrorBanner({
  variant = 'inline',
  title = 'Đã xảy ra lỗi',
  message = 'Không tải được dữ liệu. Vui lòng thử lại.',
  onRetry,
  retryLabel = 'Thử lại',
  className,
}: ErrorBannerProps) {
  if (variant === 'page') {
    return (
      <div
        role="alert"
        className={cn(
          'flex flex-col items-center justify-center gap-3 px-4 py-10 text-center lg:px-6 lg:py-14',
          className,
        )}
      >
        <span className="grid h-12 w-12 place-items-center rounded-ga-pill bg-ga-red-soft text-ga-red">
          <GaIcon name="error" size={24} />
        </span>
        <div className="space-y-1">
          <p className="font-ga-display text-[18px] font-medium text-ga-ink">{title}</p>
          <p className="ga-ui mx-auto max-w-sm text-[13px] text-ga-muted">{message}</p>
        </div>
        {onRetry && (
          <GaBtn variant="ghost" size="sm" onClick={onRetry} className="mt-1">
            {retryLabel}
          </GaBtn>
        )}
      </div>
    )
  }
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-ga border border-ga-line bg-ga-red-soft px-4 py-3 lg:flex-nowrap',
        className,
      )}
    >
      <GaIcon name="error" size={20} className="text-ga-red" />
      <div className="min-w-0 flex-1">
        <p className="ga-ui text-[13px] font-semibold text-ga-ink">{title}</p>
        <p className="ga-ui truncate text-[12.5px] text-ga-muted">{message}</p>
      </div>
      {onRetry && (
        <GaBtn variant="ghost" size="sm" onClick={onRetry}>
          {retryLabel}
        </GaBtn>
      )}
    </div>
  )
}
