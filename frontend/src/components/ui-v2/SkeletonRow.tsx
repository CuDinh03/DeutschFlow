import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * SkeletonRow — loading placeholder. Manifest: variants row|card, state shimmer.
 *
 * B-09: các ô dùng `.ga-shimmer` (quét ngang 1.3s, định nghĩa ở galerie.css) chứ không phải
 * `animate-pulse` của Tailwind. Trước đây hệ có HAI ngôn ngữ loading cạnh nhau — DataTable và
 * các màn org quét ngang, còn SkeletonRow nhấp nháy độ mờ — nên hai vùng đang tải trên cùng một
 * trang trông như hai trạng thái khác nhau. `.ga-shimmer` còn tự tắt animation dưới
 * `prefers-reduced-motion`, thứ `animate-pulse` không làm.
 *
 * Nền do chính `.ga-shimmer` vẽ (gradient surface→card→surface) nên các ô KHÔNG đặt `bg-*` riêng;
 * đặt thêm sẽ che mất gradient và ô đứng im.
 */
export interface SkeletonRowProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'row' | 'card'
}

export function SkeletonRow({ variant = 'row', className, ...props }: SkeletonRowProps) {
  if (variant === 'card') {
    return (
      <div
        className={cn('rounded-ga border border-ga-line bg-ga-card p-4 lg:p-6', className)}
        aria-hidden
        {...props}
      >
        <div className="ga-shimmer h-3 w-1/3 rounded-ga" />
        <div className="ga-shimmer mt-4 h-2.5 w-2/3 rounded-ga" />
        <div className="ga-shimmer mt-2.5 h-2.5 w-1/2 rounded-ga" />
      </div>
    )
  }
  return (
    <div
      className={cn('flex items-center gap-4 border-b border-ga-line py-3.5', className)}
      aria-hidden
      {...props}
    >
      <div className="ga-shimmer h-9 w-9 shrink-0 rounded-ga-pill" />
      <div className="ga-shimmer h-2.5 flex-1 rounded-ga" />
      <div className="ga-shimmer h-2.5 w-16 rounded-ga" />
    </div>
  )
}
