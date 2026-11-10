'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Flag, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FlaggedEntry {
  id: string
  /** Chỉ số Teil trong danh sách Teil của lượt thi. */
  teilIdx: number
  /** Tên Teil hiển thị ("Lesen Teil 2"). */
  teil: string
  /** Số câu như trên đề. */
  label: string
}

/**
 * Nút "Câu đánh dấu (N)" ở thanh dưới của thi thử (B3, 09/11/2026): mở danh sách câu đã đánh dấu trong
 * chặng đang thi (chỉ chặng hiện tại — chặng trước đã khoá), bấm một câu để sang Teil đó và tới câu đó.
 * Esc hoặc bấm ra ngoài thì đóng; trả focus về nút.
 */
export function FlaggedNav({ entries, onJump }: { entries: FlaggedEntry[]; onJump: (entry: FlaggedEntry) => void }) {
  const ta = useTranslations('v2.student.practice.assist')
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const panelId = React.useId()

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          'ga-ui inline-flex min-h-11 items-center justify-center gap-1.5 rounded-ga-touch border-[1.5px] px-3 text-ga-body font-semibold text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus',
          entries.length > 0 ? 'border-ga-yellow bg-ga-yellow-soft hover:brightness-95' : 'border-ga-line-strong bg-ga-card hover:bg-ga-side-active',
        )}
      >
        <Flag size={15} aria-hidden fill={entries.length > 0 ? 'var(--ga-yellow)' : 'none'} />
        {ta('flaggedNav', { count: entries.length })}
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          aria-label={ta('flaggedNavTitle')}
          className="ga-ui absolute bottom-full right-0 z-30 mb-2 w-72 max-w-[calc(100vw-2rem)] rounded-ga border border-ga-line bg-ga-card p-3 shadow-ga-panel"
        >
          <div className="mb-2 flex items-center gap-2">
            <p className="min-w-0 flex-1 text-ga-small font-semibold text-ga-ink">{ta('flaggedNavTitle')}</p>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                buttonRef.current?.focus()
              }}
              aria-label={ta('flaggedNavClose')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-ga-touch text-ga-muted hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
            >
              <X size={15} aria-hidden />
            </button>
          </div>
          {entries.length === 0 ? (
            <p className="text-ga-small text-ga-muted">{ta('flaggedNavEmpty')}</p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {entries.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      onJump(e)
                    }}
                    className="flex min-h-10 w-full items-center gap-2 rounded-ga-touch px-2 text-left text-ga-body text-ga-ink hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
                  >
                    <Flag size={14} aria-hidden fill="var(--ga-yellow)" className="shrink-0" />
                    {ta('flaggedNavItem', { teil: e.teil, n: e.label })}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
