'use client'

import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/** TkModal — overlay dialog (manifest TkModal: variants sm|md|lg, open|closed). Wraps Radix Dialog. */
const SIZE = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl' } as const

export interface TkModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: React.ReactNode
  description?: React.ReactNode
  size?: keyof typeof SIZE
  children: React.ReactNode
  /** Sticky footer slot (actions). */
  footer?: React.ReactNode
  className?: string
}

export function TkModal({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  children,
  footer,
  className,
}: TkModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          className={cn(
            'ga-scope fixed left-1/2 top-1/2 z-[101] flex max-h-[90vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-ga border border-ga-line bg-ga-card shadow-ga-panel',
            SIZE[size],
            className,
          )}
        >
          {(title || description) && (
            <div className="flex items-start justify-between gap-4 border-b border-ga-line px-6 py-4">
              <div className="min-w-0">
                {title && (
                  <Dialog.Title className="font-ga-display text-[20px] font-medium text-ga-ink">
                    {title}
                  </Dialog.Title>
                )}
                {description && (
                  <Dialog.Description className="ga-ui mt-1 text-[13px] text-ga-muted">
                    {description}
                  </Dialog.Description>
                )}
              </div>
              <Dialog.Close
                aria-label="Đóng"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-ga text-ga-subtle transition-colors hover:bg-ga-side-active hover:text-ga-ink"
              >
                <X size={16} />
              </Dialog.Close>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && (
            <div className="flex items-center justify-end gap-2 border-t border-ga-line px-6 py-4">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
