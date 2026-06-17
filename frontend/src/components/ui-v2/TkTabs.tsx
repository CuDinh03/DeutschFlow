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
      className={cn('flex items-center gap-6 border-b border-ga-line', className)}
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
