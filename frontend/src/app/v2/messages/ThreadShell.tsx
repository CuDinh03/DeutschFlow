'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'

export const fmtDay = (d: string | null | undefined) => (d ? format(new Date(d), 'dd/MM HH:mm') : '')
export const initial = (n: string | null | undefined) => ((n ?? '?').trim()[0] ?? '?').toUpperCase()

interface ThreadShellProps {
  /** Round avatar/icon for the counterpart or class. */
  avatar: ReactNode
  title: string
  /** Small line under the title (e.g. "Kênh chat cả lớp"); omitted for direct threads. */
  caption?: string
  /** Back to the conversation list — mobile only, where the two panes don't fit side by side. */
  onBack: () => void
  /**
   * Re-scrolls the message area to the bottom whenever this value changes. Pass whatever marks
   * "the content moved" (message count, active thread key).
   */
  scrollKey: unknown
  children: ReactNode
  footer: ReactNode
  error?: string
}

/** Header + scrolling message area + composer footer, shared by both thread kinds. */
export function ThreadShell({
  avatar,
  title,
  caption,
  onBack,
  scrollKey,
  children,
  footer,
  error,
}: ThreadShellProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [scrollKey])

  return (
    <>
      <header className="flex items-center gap-3 border-b border-ga-line px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 grid h-10 w-10 shrink-0 place-items-center md:hidden"
          aria-label="Quay lại"
        >
          <ArrowLeft size={18} className="text-ga-muted" />
        </button>
        {avatar}
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-ga-ink">{title}</span>
          {caption && <span className="ga-ui block text-[11px] text-ga-subtle">{caption}</span>}
        </span>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {children}
      </div>

      {footer}
      {error && <p className="ga-ui px-4 py-2 text-[12px] text-ga-red">{error}</p>}
    </>
  )
}
