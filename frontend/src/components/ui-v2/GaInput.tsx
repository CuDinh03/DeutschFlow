'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * GaInput — control nhập liệu chuẩn Galerie (DS §8.2, primitive từng THIẾU trong lớp ga).
 * Radius touch 6px (ngoại lệ có tên DS §6.2) · min-height 44px mobile (D8) · focus-visible ring ·
 * `invalid` → aria-invalid + viền/ring đỏ (F-05/aria-invalid từng là 0/27).
 * Font-size <1024px được galerie.css ép 16px sẵn (chống iOS auto-zoom) — không đổi ở đây.
 */
export interface GaInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export const GaInput = React.forwardRef<HTMLInputElement, GaInputProps>(function GaInput(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      data-slot="ga-input"
      aria-invalid={invalid || props['aria-invalid'] || undefined}
      className={cn(
        'w-full min-w-0 rounded-ga-touch border border-ga-line bg-ga-card px-3.5 py-2.5 text-ga-small font-medium text-ga-ink',
        'min-h-11 lg:min-h-9',
        'placeholder:text-ga-subtle',
        'outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ga-focus',
        'disabled:pointer-events-none disabled:opacity-50',
        'aria-[invalid=true]:border-ga-red aria-[invalid=true]:focus-visible:ring-ga-red',
        className,
      )}
      {...props}
    />
  )
})

export interface GaTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export const GaTextarea = React.forwardRef<HTMLTextAreaElement, GaTextareaProps>(
  function GaTextarea({ className, invalid, rows = 4, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        data-slot="ga-textarea"
        aria-invalid={invalid || props['aria-invalid'] || undefined}
        className={cn(
          'w-full min-w-0 rounded-ga-touch border border-ga-line bg-ga-card px-3.5 py-2.5 text-ga-small font-medium text-ga-ink',
          'placeholder:text-ga-subtle',
          'outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ga-focus',
          'disabled:pointer-events-none disabled:opacity-50',
          'aria-[invalid=true]:border-ga-red aria-[invalid=true]:focus-visible:ring-ga-red',
          className,
        )}
        {...props}
      />
    )
  },
)
