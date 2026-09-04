'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

/** TkTabs — underline tabs (manifest variant: underline). Wraps Radix Tabs. */
export const TkTabs = TabsPrimitive.Root

export function TkTabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      // Nhiều tab nhãn tiếng Việt sẽ tràn trên khổ hẹp → cho cuộn ngang dưới lg
      // (repo chưa có tiện ích ẩn thanh cuộn nên giữ thanh cuộn mặc định).
      className={cn(
        'flex items-center gap-6 overflow-x-auto border-b border-ga-line lg:overflow-x-visible',
        className,
      )}
      {...props}
    />
  )
}

export function TkTabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'ga-ui -mb-px border-b-2 border-transparent px-1 pb-3 pt-2 text-[13px] font-semibold text-ga-muted transition-colors',
        // Trong vùng cuộn ngang, tab không được co lại (nhãn sẽ xuống dòng từng chữ);
        // 44px chạm tay (F-06/D8). Từ lg trả lại hành vi co giãn và chiều cao gốc.
        'min-h-11 shrink-0 whitespace-nowrap lg:min-h-0 lg:shrink lg:whitespace-normal',
        'hover:text-ga-ink data-[state=active]:border-ga-accent data-[state=active]:text-ga-ink',
        // Focus bàn phím phải NHÌN THẤY (F-05) — đổi màu chữ đơn thuần không đủ.
        'outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-inset',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export function TkTabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      // Radix ẩn panel không hoạt động bằng THUỘC TÍNH `hidden` (specificity 0,1,0 từ UA sheet) —
      // truyền vào một class hiển thị như `flex` là đè mất và panel rỗng vẫn chiếm chỗ (QA 17/08:
      // tab Bài học/Giai đoạn hở ~300px trắng vì panel cây inactive vẫn flex-1). `[&[hidden]]:hidden`
      // sinh selector `.x[hidden]` (0,2,0) nên luôn thắng mọi class hiển thị truyền từ ngoài.
      className={cn('pt-5 outline-none [&[hidden]]:hidden', className)}
      {...props}
    />
  )
}
