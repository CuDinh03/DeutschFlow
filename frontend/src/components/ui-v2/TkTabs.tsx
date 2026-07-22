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
        // 40px chạm tay. Từ lg trả lại hành vi co giãn và chiều cao gốc.
        'min-h-[40px] shrink-0 whitespace-nowrap lg:min-h-0 lg:shrink lg:whitespace-normal',
        'hover:text-ga-ink data-[state=active]:border-ga-accent data-[state=active]:text-ga-ink',
        'outline-none focus-visible:text-ga-ink',
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
  return <TabsPrimitive.Content className={cn('pt-5 outline-none', className)} {...props} />
}
