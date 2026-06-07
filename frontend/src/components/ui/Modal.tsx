'use client'

// Accessible modal primitive. Use this in place of the bare `<div className="fixed inset-0 z-50">`
// pattern that currently powers (for example) VocabDetailModal — that pattern has no role,
// no aria-modal, no focus trap, and no Esc handler, so VoiceOver/TalkBack walks behind the
// backdrop and keyboard Tab leaks to the page below.
//
// Behaviour:
// - role="dialog" + aria-modal="true" + aria-labelledby pointing at the caller's heading id
// - keyboard focus is trapped while open (Tab cycles inside; Shift+Tab reverses)
// - Esc closes via onClose
// - focus returns to the element that was focused before the modal opened
// - inert background guidance: render this in a portal at <body>; the caller controls when
//   the backdrop dismisses

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export interface ModalProps {
  /** Whether the modal is open. Caller controls visibility. */
  open: boolean
  /** Called when Esc is pressed or the caller wires a backdrop click. */
  onClose: () => void
  /**
   * id of the heading element inside `children` that names this dialog (a11y requirement).
   * Pass `aria-labelledby` on a visible <h2 id="..."> in your modal content.
   */
  labelledById: string
  /** Optional id of a descriptive element (e.g. a <p>) for `aria-describedby`. */
  describedById?: string
  /** Modal content. The caller renders the backdrop + container styling. */
  children: React.ReactNode
  /** Override the root container className (defaults to a centered overlay). */
  className?: string
}

export function Modal({
  open,
  onClose,
  labelledById,
  describedById,
  children,
  className,
}: ModalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) return
    previousFocusRef.current = document.activeElement

    // Move focus into the modal on mount.
    const first = containerRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    first?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      const focusable = Array.from(
        containerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
      ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1)
      if (focusable.length === 0) {
        e.preventDefault()
        return
      }
      const firstEl = focusable[0]
      const lastEl = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      // Return focus to whatever opened the modal (e.g. the trigger button).
      ;(previousFocusRef.current as HTMLElement | null)?.focus?.()
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledById}
      aria-describedby={describedById}
      className={className ?? 'fixed inset-0 z-50 flex items-center justify-center'}
    >
      {children}
    </div>,
    document.body,
  )
}
