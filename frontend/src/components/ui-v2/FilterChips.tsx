'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface FilterChipOption<V extends string = string> {
  value: V
  label: React.ReactNode
  /** Số bản ghi khớp — hiện mờ sau nhãn; bỏ trống = không hiện. */
  count?: number | string
}

export interface FilterChipsProps<V extends string = string> {
  options: FilterChipOption<V>[]
  value: V
  onChange: (value: V) => void
  /** Tên nhóm cho screen reader, vd "Lọc theo vai trò". */
  ariaLabel: string
  className?: string
  /** Tiền tố data-testid cho từng chip: `${testIdPrefix}-${value}`. */
  testIdPrefix?: string
}

/**
 * FilterChips — một hàng nút lọc chọn-một (vd vai trò, trạng thái). Tách từ bộ lọc vai trò của
 * trang Người dùng admin (09/11/2026) để các trang danh sách khác dùng chung một kiểu.
 *
 * Mỗi chip là một <button aria-pressed> thật (không phải radio giả), cao 40px trên mobile để đủ
 * vùng chạm, về chiều cao tự nhiên từ lg.
 */
export function FilterChips<V extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  testIdPrefix,
}: FilterChipsProps<V>) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn('flex flex-wrap gap-2', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            data-testid={testIdPrefix ? `${testIdPrefix}-${o.value}` : undefined}
            onClick={() => onChange(o.value)}
            className={cn(
              'ga-ui min-h-[40px] cursor-pointer rounded-ga border px-3.5 py-2 text-ga-caption font-semibold transition-colors lg:min-h-0',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus',
              active
                ? 'border-ga-ink bg-ga-ink text-ga-card'
                : 'border-ga-border bg-ga-card text-ga-muted hover:border-ga-ink hover:text-ga-ink',
            )}
          >
            {o.label}
            {o.count != null && <span className="ml-1.5 opacity-70">{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
