'use client'

import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { useGaShellRole } from './gaScope'
import type { RoleId } from './nav'

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
  /** Override nhãn nút đóng (i18n contract W0-C8: default từ v2.ui, prop để tuỳ ngữ cảnh). */
  closeLabel?: string
  /** Override role accent cho portal content; mặc định lấy từ GaShell context (remediation #1). */
  gaRole?: RoleId
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
  closeLabel,
  gaRole,
  className,
}: TkModalProps) {
  const t = useTranslations('v2.ui')
  // Portal scope contract (W0-C4 + remediation #1): content ra ngoài .ga-scope nên tự mang
  // class + data-role; role đến từ GaShell context (không phải sửa từng page), prop override được.
  const shellRole = useGaShellRole()
  const role = gaRole ?? shellRole
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Overlay portaled ra body — NGOÀI .ga-scope — nên phải tự mang ga-scope để
            bg-ga-overlay resolve được token (portal scope contract W0-C4). */}
        <Dialog.Overlay className="ga-scope fixed inset-0 z-[100] bg-ga-overlay backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          data-slot="tk-modal-content"
          data-role={role}
          className={cn(
            // `max-h-[90dvh]` dưới lg: thanh công cụ động của trình duyệt mobile làm 90vh vượt
            // quá vùng nhìn thấy → footer bị đẩy khuất. Từ lg giữ nguyên 90vh như thiết kế gốc.
            'ga-scope fixed left-1/2 top-1/2 z-[101] flex max-h-[90dvh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-ga border border-ga-line bg-ga-card shadow-ga-panel lg:max-h-[90vh]',
            SIZE[size],
            className,
          )}
        >
          {(title || description) && (
            <div className="flex items-start justify-between gap-4 border-b border-ga-line px-4 py-4 lg:px-6">
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
                aria-label={closeLabel ?? t('close')}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-ga text-ga-subtle transition-colors hover:bg-ga-side-active hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-inset lg:h-8 lg:w-8"
              >
                <X size={16} />
              </Dialog.Close>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6">{children}</div>
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ga-line px-4 py-4 lg:flex-nowrap lg:px-6">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
