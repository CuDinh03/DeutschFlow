'use client'

import { type ReactNode } from 'react'
import { format } from 'date-fns'
import { Users } from 'lucide-react'
import type { Conversation } from '@/lib/messagesApi'
import { GaCap, LoadingState } from '@/components/ui-v2'
import { isSameSelection, type ChannelClass, type Selection } from './types'
import { initial } from './ThreadShell'

const fmtTime = (d: string | null | undefined) => (d ? format(new Date(d), 'HH:mm') : '')

interface ConversationListProps {
  classes: ChannelClass[]
  conversations: Conversation[]
  selection: Selection | null
  onSelect: (next: Selection) => void
  loading: boolean
  /** Optional action in the list header (the teacher's "message a student" compose button). */
  headerAction?: ReactNode
  /** Copy shown when the caller has no direct threads yet. */
  emptyDirectText: ReactNode
}

/** One row of the unified list — same shape for class channels and direct threads. */
function Row({
  active,
  avatar,
  title,
  meta,
  preview,
  badge,
  onClick,
}: {
  active: boolean
  avatar: ReactNode
  title: string
  meta?: string
  preview: string
  badge?: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={`flex w-full items-center gap-3 border-b border-ga-line px-4 py-3 text-left transition-colors hover:bg-ga-surface ${active ? 'bg-ga-side-active' : ''}`}
    >
      {avatar}
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[14px] font-semibold text-ga-ink">{title}</span>
          {meta && <span className="shrink-0 text-[11px] text-ga-subtle">{meta}</span>}
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[12.5px] text-ga-muted">{preview}</span>
          {badge}
        </span>
      </span>
    </button>
  )
}

/**
 * The single inbox list: class group channels first, then direct 1-1 threads. Merging both into one
 * pane is deliberate — a student who has a class announcement and a reply from their teacher sees
 * both in one place instead of hunting across tabs.
 */
export function ConversationList({
  classes,
  conversations,
  selection,
  onSelect,
  loading,
  headerAction,
  emptyDirectText,
}: ConversationListProps) {
  const totalUnread = conversations.reduce((s, c) => s + (c.unread || 0), 0)

  return (
    <>
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <GaCap>Tin nhắn</GaCap>
          {totalUnread > 0 && (
            <span className="rounded-full bg-ga-accent px-2 py-0.5 text-[11px] font-bold text-ga-accent-ink">
              {totalUnread}
            </span>
          )}
        </div>
        {headerAction}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <LoadingState label="Đang tải tin nhắn…" />
        ) : (
          <>
            {/* Class group channels */}
            <div className="border-b border-ga-line bg-ga-surface px-4 py-1.5">
              <GaCap>Nhóm lớp</GaCap>
            </div>
            {classes.length === 0 ? (
              <p className="ga-ui px-4 py-4 text-[12.5px] text-ga-muted">
                Bạn chưa tham gia lớp nào.
              </p>
            ) : (
              classes.map((c) => (
                <Row
                  key={`class-${c.id}`}
                  active={isSameSelection(selection, { kind: 'class', classId: c.id, name: c.name })}
                  onClick={() => onSelect({ kind: 'class', classId: c.id, name: c.name })}
                  avatar={
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ga-accent-soft text-ga-accent">
                      <Users size={17} />
                    </span>
                  }
                  title={c.name}
                  preview={c.subtitle}
                />
              ))
            )}

            {/* Direct 1-1 threads */}
            <div className="border-y border-ga-line bg-ga-surface px-4 py-1.5">
              <GaCap>Cá nhân</GaCap>
            </div>
            {conversations.length === 0 ? (
              <p className="ga-ui px-4 py-4 text-[12.5px] text-ga-muted">{emptyDirectText}</p>
            ) : (
              conversations.map((c) => {
                const name = c.displayName || c.email || `#${c.userId}`
                return (
                  <Row
                    key={`direct-${c.userId}`}
                    active={isSameSelection(selection, { kind: 'direct', userId: c.userId, name })}
                    onClick={() => onSelect({ kind: 'direct', userId: c.userId, name })}
                    avatar={
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ga-accent-soft text-[14px] font-bold text-ga-accent">
                        {initial(c.displayName || c.email)}
                      </span>
                    }
                    title={name}
                    meta={fmtTime(c.lastAt)}
                    preview={c.lastMessage || '—'}
                    badge={
                      c.unread > 0 ? (
                        <span className="shrink-0 rounded-full bg-ga-accent px-1.5 text-[10px] font-bold text-ga-accent-ink">
                          {c.unread}
                        </span>
                      ) : undefined
                    }
                  />
                )
              })
            )}
          </>
        )}
      </div>
    </>
  )
}
