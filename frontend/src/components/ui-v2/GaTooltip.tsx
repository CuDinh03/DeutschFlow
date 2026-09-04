'use client'

import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
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
 * GaTooltip — adapter Radix Tooltip + ga skin (D6). Nội dung nền ink, chữ giấy sáng —
 * tooltip là thông tin phụ trợ, không mang role accent nhưng vẫn theo portal scope
 * contract (W0-C4) để token resolve đúng ngoài `.ga-scope`.
 * Tooltip là hover/focus affordance — mobile không phụ thuộc vào nó (a11y: nội dung
 * quan trọng không được CHỈ nằm trong tooltip, xem quyết định song ngữ #3).
 */
export interface GaTooltipProps extends React.ComponentProps<typeof TooltipPrimitive.Root> {
  gaRole?: RoleId
}

export function GaTooltip({ gaRole, delayDuration = 200, children, ...props }: GaTooltipProps) {
  return (
    <GaPortalRoleProvider gaRole={gaRole}>
      <TooltipPrimitive.Provider delayDuration={delayDuration}>
        <TooltipPrimitive.Root data-slot="ga-tooltip" {...props}>
          {children}
        </TooltipPrimitive.Root>
      </TooltipPrimitive.Provider>
    </GaPortalRoleProvider>
  )
}

export const GaTooltipTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof TooltipPrimitive.Trigger>
>(function GaTooltipTrigger({ className, ...props }, ref) {
  const detect = useGaRoleDetector()
  return (
    <TooltipPrimitive.Trigger
      data-slot="ga-tooltip-trigger"
      ref={composeRefs(ref, detect)}
      // Trigger contract (Gate 0): dùng trực tiếp → có focus-visible + ≥44px mặc định;
      // asChild → phần tử con tự theo contract riêng.
      className={props.asChild ? className : cn(GA_TRIGGER_DEFAULT_CLASSES, className)}
      {...props}
    />
  )
})

export const GaTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof TooltipPrimitive.Content>
>(function GaTooltipContent({ className, sideOffset = 6, children, ...props }, ref) {
  const role = useGaPortalRole()
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        data-slot="ga-tooltip-content"
        data-role={role}
        sideOffset={sideOffset}
        className={cn(
          'ga-scope z-50 max-w-xs rounded-ga bg-ga-ink px-2.5 py-1.5 text-ga-caption font-medium text-ga-bg shadow-ga-panel',
          'animate-in fade-in',
          className,
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
})
