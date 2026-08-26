'use client'

import * as React from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

/** TkSearch — search input with icon (manifest TkSearch, states empty|typing). */
export interface TkSearchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string
}

export function TkSearch({ containerClassName, className, ...props }: TkSearchProps) {
  return (
    <div
      className={cn(
        // `min-w-0`: không có nó, `flex-1` giữ min-width:auto = bề rộng mặc định của <input>
        // (~170px) nên ô tìm kiếm đẩy tràn cả hàng trên khổ hẹp.
        // Ring focus-within: shadow-ga-card-hover quá mờ để làm focus indicator (F-05) — ring accent
        // là chỉ báo bàn phím nhìn thấy được; radius touch cho control nhập liệu (DS §6.2).
        // min-h 44px dưới lg (F-06/D8 — Gate 0 review); lg trả lại chiều cao compact.
        'flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-ga-touch border border-ga-line bg-ga-card px-4 py-2.5 transition-shadow focus-within:ring-2 focus-within:ring-ga-focus lg:min-h-0',
        containerClassName,
      )}
    >
      <Search size={15} strokeWidth={2} className="shrink-0 text-ga-subtle" />
      <input
        type="search"
        className={cn(
          // <input> là flex item nên min-width:auto = bề rộng nội tại (~20 ký tự) → phải min-w-0.
          'ga-ui w-full min-w-0 bg-transparent text-[13px] font-medium text-ga-ink outline-none placeholder:text-ga-subtle',
          className,
        )}
        {...props}
      />
    </div>
  )
}
