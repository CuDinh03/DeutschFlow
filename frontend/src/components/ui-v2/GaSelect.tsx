'use client'

import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RoleId } from './nav'
import { GaPortalRoleProvider, useGaPortalRole, useGaRoleDetector, composeRefs } from './gaScope'

/**
 * GaSelect — adapter Radix Select + ga skin (D6: adapter, không rebuild behavior).
 * Trigger theo chuẩn control nhập liệu: radius touch (DS §6.2), min-height 44px mobile (D8),
 * focus-visible ring, aria-invalid. Content theo portal scope contract (W0-C4).
 */
export interface GaSelectProps extends React.ComponentProps<typeof SelectPrimitive.Root> {
  gaRole?: RoleId
  children: React.ReactNode
}

export function GaSelect({ gaRole, children, ...props }: GaSelectProps) {
  return (
    <GaPortalRoleProvider gaRole={gaRole}>
      <SelectPrimitive.Root data-slot="ga-select" {...props}>
        {children}
      </SelectPrimitive.Root>
    </GaPortalRoleProvider>
  )
}

export const GaSelectValue = SelectPrimitive.Value

export const GaSelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof SelectPrimitive.Trigger> & { invalid?: boolean }
>(function GaSelectTrigger({ className, invalid, children, ...props }, ref) {
  const detect = useGaRoleDetector()
  return (
    <SelectPrimitive.Trigger
      ref={composeRefs(ref, detect)}
      data-slot="ga-select-trigger"
      aria-invalid={invalid || undefined}
      className={cn(
        'flex w-full min-w-0 items-center justify-between gap-2 rounded-ga-touch border border-ga-line bg-ga-card px-3.5 py-2.5 text-ga-small font-medium text-ga-ink',
        'min-h-11 lg:min-h-9',
        'outline-none focus-visible:ring-2 focus-visible:ring-ga-focus',
        'disabled:pointer-events-none disabled:opacity-50',
        'data-[placeholder]:text-ga-subtle',
        'aria-[invalid=true]:border-ga-red aria-[invalid=true]:focus-visible:ring-ga-red',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown size={16} className="shrink-0 text-ga-subtle" aria-hidden />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
})

export const GaSelectContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof SelectPrimitive.Content>
>(function GaSelectContent({ className, children, position = 'popper', ...props }, ref) {
  const role = useGaPortalRole()
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        data-slot="ga-select-content"
        data-role={role}
        position={position}
        className={cn(
          'ga-scope z-50 max-h-[min(24rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-ga border border-ga-line bg-ga-card text-ga-ink shadow-ga-panel',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="flex items-center justify-center py-1 text-ga-subtle">
          <ChevronUp size={14} aria-hidden />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex items-center justify-center py-1 text-ga-subtle">
          <ChevronDown size={14} aria-hidden />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
})

export const GaSelectItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof SelectPrimitive.Item>
>(function GaSelectItem({ className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Item
      ref={ref}
      data-slot="ga-select-item"
      className={cn(
        'relative flex min-h-11 cursor-default select-none items-center gap-2 rounded-ga px-3 py-2.5 text-ga-small text-ga-ink outline-none lg:min-h-0',
        // Highlight bàn phím/hover: nền surface + KHÔNG chỉ đổi màu — kèm chuyển weight khi checked.
        'data-[highlighted]:bg-ga-surface data-[state=checked]:font-semibold',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="grid w-4 shrink-0 place-items-center">
        <SelectPrimitive.ItemIndicator>
          <Check size={14} className="text-ga-accent" aria-hidden />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
})

export const GaSelectGroup = SelectPrimitive.Group

export function GaSelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      className={cn('px-3 py-2 text-ga-eyebrow uppercase text-ga-subtle', className)}
      {...props}
    />
  )
}

export function GaSelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return <SelectPrimitive.Separator className={cn('my-1 h-px bg-ga-border', className)} {...props} />
}
