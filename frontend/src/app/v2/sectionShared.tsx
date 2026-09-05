'use client'

import * as React from 'react'
import { GaCard } from '@/components/ui-v2'
import { cn } from '@/lib/utils'

/**
 * Phần NHẸ tách từ analyticsShared (W7 / FE-09, audit lag 02/09): GaSection + formatter dùng
 * chung — KHÔNG import recharts. Trước đây materials/media/org-roles chỉ cần khung section mà
 * page chunk vẫn gánh trọn chart machinery (~100KB+) vì mọi thứ nằm chung file với 5 component
 * chart. Trang có vẽ chart thì import analyticsShared như cũ (bên đó re-export lại các tên này
 * nên không nơi nào phải đổi kiểu import kép).
 */

// ── Formatters ────────────────────────────────────────────────────────────────
// 06/09/2026 (F-I18N-04): fmtVnd / fmtDateTime / nfVN ép 'vi-VN' đã chuyển sang lib/i18n/format.ts
// (hàm thuần) + hook useFmt() (theo locale UI). Trang dùng `const fmt = useFmt()` →
// fmt.num / fmt.date / fmt.dateTime / fmt.vnd / fmt.vndCompact.

// ── Section card (= proto AdSection) ────────────────────────────────────────────
export function GaSection({
  title,
  right,
  children,
  className,
  bodyClassName,
}: {
  title: React.ReactNode
  right?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <GaCard className={cn('overflow-hidden', className)}>
      {/* Dưới lg: hàng tiêu đề được phép xuống dòng để slot `right` (chú thích / bộ đếm) không
          bóp tiêu đề còn min-content. Từ lg giữ nguyên một hàng + đệm 20px như thiết kế gốc. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ga-border px-4 py-[14px] lg:flex-nowrap lg:px-5">
        <h3 className="min-w-0 font-ga-display text-[17px] font-medium text-ga-ink lg:min-w-[auto]">{title}</h3>
        {right}
      </div>
      {/* Đệm thân giữ nguyên `p-5` ở MỌI khổ có chủ ý: 9 nơi gọi truyền `bodyClassName="p-0"`
          (các bảng cuộn ngang) và twMerge chỉ khử được lớp cùng tiền tố — thêm `lg:p-5` sẽ làm
          các bảng đó mọc lại 20px đệm ở desktop. Đã đo: ở 320px thân section còn ~246px, không tràn. */}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </GaCard>
  )
}
