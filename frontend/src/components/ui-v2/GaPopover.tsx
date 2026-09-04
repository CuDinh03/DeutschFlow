'use client'

import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'
import type { RoleId } from './nav'
import {
  GaPortalRoleProvider,
  useGaPortalRole,
  useGaRoleDetector,
  composeRefs,
  GA_TRIGGER_DEFAULT_CLASSES,
} from './gaScope'

/**
 * GaPopover — adapter Radix Popover + ga skin (D6: adapter, không rebuild behavior).
 * Consumer Wave 0: NotificationBell (gỡ cross-import components/ui/popover legacy).
 *
 * Portal scope contract (W0-C4): GaPopoverContent tự mang `.ga-scope` + `data-role`
 * (role tường minh qua prop `gaRole` trên GaPopover, hoặc tự dò từ vị trí trigger).
 */
export interface GaPopoverProps extends React.ComponentProps<typeof PopoverPrimitive.Root> {
  gaRole?: RoleId
}

export function GaPopover({ gaRole, children, ...props }: GaPopoverProps) {
  return (
    <GaPortalRoleProvider gaRole={gaRole}>
      <PopoverPrimitive.Root data-slot="ga-popover" {...props}>
        {children}
      </PopoverPrimitive.Root>
    </GaPortalRoleProvider>
  )
}

export const GaPopoverTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof PopoverPrimitive.Trigger>
>(function GaPopoverTrigger({ className, ...props }, ref) {
  const detect = useGaRoleDetector()
  return (
    <PopoverPrimitive.Trigger
      data-slot="ga-popover-trigger"
      ref={composeRefs(ref, detect)}
      // Trigger contract (Gate 0): dùng trực tiếp → có focus-visible + ≥44px mặc định;
      // asChild → phần tử con tự theo contract riêng (GaBtn…).
      className={props.asChild ? className : cn(GA_TRIGGER_DEFAULT_CLASSES, className)}
      {...props}
    />
  )
})

export const GaPopoverContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof PopoverPrimitive.Content>
>(function GaPopoverContent({ className, align = 'center', sideOffset = 4, ...props }, ref) {
  const role = useGaPortalRole()
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        data-slot="ga-popover-content"
        data-role={role}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          // `ga-scope` tái khai báo token trên panel portaled (xem gaScope.tsx).
          'ga-scope z-50 rounded-ga border border-ga-line bg-ga-card text-ga-ink shadow-ga-panel outline-none',
          'data-[state=open]:animate-in data-[state=open]:fade-in',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
})

export const GaPopoverAnchor = PopoverPrimitive.Anchor
