'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { apiMessage } from '@/lib/api'
import { listConversations, type Conversation } from '@/lib/messagesApi'
import { ConversationList } from './ConversationList'
import { DirectThread } from './DirectThread'
import { ClassThread } from './ClassThread'
import type { ChannelClassLoader, ChannelClass, Selection } from './types'

/** Conversation-list refresh cadence (the active thread polls faster, on its own). */
const POLL_MS = 12_000

interface MessagesInboxProps {
  /** Role-specific class enumeration; the channel endpoints themselves are role-agnostic. */
  loadClasses: ChannelClassLoader
  /** Deep-link: open (or start) a direct thread with this user on mount (`?to=`). */
  initialUserId?: number | null
  /** Counterpart name for a fresh thread not yet in the conversation list (`?to=` from a class page). */
  initialName?: string | null
  /**
   * Optional action for the list header (e.g. the teacher's compose button). Receives `openDirect`
   * so the action can start a thread with any user.
   */
  headerAction?: (openDirect: (userId: number, name: string) => void) => ReactNode
  /** Copy shown when the caller has no direct threads yet. */
  emptyDirectText: ReactNode
}

/**
 * The single messaging surface for students and teachers: class group channels and direct 1-1
 * threads in one list, one thread pane. Both sides render the same component — only the class
 * loader and the optional header action differ by role.
 */
export function MessagesInbox({
  loadClasses,
  initialUserId,
  initialName,
  headerAction,
  emptyDirectText,
}: MessagesInboxProps) {
  const [classes, setClasses] = useState<ChannelClass[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selection, setSelection] = useState<Selection | null>(
    initialUserId != null ? { kind: 'direct', userId: initialUserId, name: initialName ?? '' } : null,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refreshConversations = useCallback(async () => {
    try {
      const list = await listConversations()
      setConversations(list)
      // A `?to=` deep link arrives with only an id when the counterpart isn't in the list yet;
      // fill in the real name once the list resolves it.
      setSelection((cur) => {
        if (cur?.kind !== 'direct' || cur.name) return cur
        const match = list.find((c) => c.userId === cur.userId)
        return match ? { ...cur, name: match.displayName || match.email || cur.name } : cur
      })
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    }
  }, [])

  // Initial load of both sides, then poll the direct-conversation list. The class list is fetched
  // once — membership changes far more slowly than messages do, and re-polling it would cost a
  // request per tick for a row whose contents never change.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [classResult] = await Promise.allSettled([loadClasses(), refreshConversations()])
      if (cancelled) return
      if (classResult.status === 'fulfilled') setClasses(classResult.value)
      else setError(apiMessage(classResult.reason))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [loadClasses, refreshConversations])

  useEffect(() => {
    const t = setInterval(() => void refreshConversations(), POLL_MS)
    return () => clearInterval(t)
  }, [refreshConversations])

  const openDirect = useCallback((userId: number, name: string) => {
    setSelection({ kind: 'direct', userId, name })
  }, [])

  return (
    <div className="flex min-h-0 flex-1 border-t border-ga-line">
      <aside
        aria-label="Danh sách tin nhắn"
        className={`${selection != null ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r border-ga-line md:w-[300px]`}
      >
        <ConversationList
          classes={classes}
          conversations={conversations}
          selection={selection}
          onSelect={setSelection}
          loading={loading}
          headerAction={headerAction?.(openDirect)}
          emptyDirectText={emptyDirectText}
        />
        {error && <p className="ga-ui px-4 py-2 text-[12px] text-ga-red">{error}</p>}
      </aside>

      <section className={`${selection == null ? 'hidden md:flex' : 'flex'} min-h-0 flex-1 flex-col`}>
        {selection == null ? (
          <div className="ga-ui flex flex-1 items-center justify-center px-6 text-center text-[14px] text-ga-muted">
            Chọn một hội thoại hoặc nhóm lớp để bắt đầu nhắn tin.
          </div>
        ) : selection.kind === 'class' ? (
          <ClassThread
            key={`class-${selection.classId}`}
            classId={selection.classId}
            name={selection.name}
            onBack={() => setSelection(null)}
          />
        ) : (
          <DirectThread
            key={`direct-${selection.userId}`}
            userId={selection.userId}
            name={selection.name}
            onBack={() => setSelection(null)}
            onSent={() => void refreshConversations()}
          />
        )}
      </section>
    </div>
  )
}
