'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import { ArrowLeft, Send } from 'lucide-react'
import { apiMessage } from '@/lib/api'
import {
  listConversations,
  getThread,
  sendMessage,
  type Conversation,
  type ChatMessage,
} from '@/lib/messagesApi'
import { GaCap, LoadingState } from '@/components/ui-v2'

const POLL_MS = 12_000 // conversation-list refresh cadence
const THREAD_POLL_MS = 5_000 // active thread — snappier so an incoming reply appears near-live
const fmtTime = (d: string | null | undefined) => (d ? format(new Date(d), 'HH:mm') : '')
const fmtDay = (d: string | null | undefined) => (d ? format(new Date(d), 'dd/MM HH:mm') : '')
const initial = (n: string | null | undefined) => ((n ?? '?').trim()[0] ?? '?').toUpperCase()

interface MessagesViewProps {
  /** Deep-link: open (or start) a thread with this user on mount (`?to=`). */
  initialUserId?: number | null
  /** Counterpart name for a fresh thread not yet in the conversation list (`?to=` from class/roster). */
  initialName?: string | null
  /**
   * Optional action rendered in the conversation-list header (e.g. a "message a new student"
   * compose button). Receives `openThread` so the action can open/start a thread with any user.
   */
  headerAction?: (openThread: (userId: number, name: string) => void) => ReactNode
  /** Empty-state copy for the conversation list (defaults to the "open from class page" hint). */
  emptyText?: ReactNode
}

/** Shared student/teacher 1-1 chat surface (conversation list + thread + composer). */
export function MessagesView({ initialUserId, initialName, headerAction, emptyText }: MessagesViewProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<number | null>(initialUserId ?? null)
  const [activeName, setActiveName] = useState<string | null>(initialName ?? null)
  const [thread, setThread] = useState<ChatMessage[]>([])
  const [loadingConvos, setLoadingConvos] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const loadConversations = useCallback(async () => {
    try {
      const list = await listConversations()
      setConversations(list)
      setActiveId((cur) => {
        if (cur != null) {
          const match = list.find((c) => c.userId === cur)
          if (match) setActiveName(match.displayName)
        }
        return cur
      })
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoadingConvos(false)
    }
  }, [])

  const loadThread = useCallback(async (userId: number, spin: boolean) => {
    if (spin) setLoadingThread(true)
    try {
      setThread(await getThread(userId))
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      if (spin) setLoadingThread(false)
    }
  }, [])

  // Initial load + poll the conversation list.
  useEffect(() => {
    void loadConversations()
    const t = setInterval(() => void loadConversations(), POLL_MS)
    return () => clearInterval(t)
  }, [loadConversations])

  // Load + poll the active thread.
  useEffect(() => {
    if (activeId == null) {
      setThread([])
      return
    }
    void loadThread(activeId, true)
    const t = setInterval(() => void loadThread(activeId, false), THREAD_POLL_MS)
    return () => clearInterval(t)
  }, [activeId, loadThread])

  // Keep the thread scrolled to the newest message.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [thread, activeId])

  const openConversation = (c: Conversation) => {
    setActiveId(c.userId)
    setActiveName(c.displayName)
  }

  // Open (or start) a thread with an arbitrary user — used by the compose picker.
  const openThread = useCallback((userId: number, name: string) => {
    setActiveId(userId)
    setActiveName(name)
  }, [])

  const send = async () => {
    const text = draft.trim()
    if (!text || activeId == null) return
    setSending(true)
    try {
      const msg = await sendMessage(activeId, text)
      setThread((t) => [...t, msg])
      setDraft('')
      void loadConversations()
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setSending(false)
    }
  }

  const totalUnread = conversations.reduce((s, c) => s + (c.unread || 0), 0)

  return (
    <div className="flex min-h-0 flex-1 border-t border-ga-line">
      {/* Conversation list */}
      <aside
        className={`${activeId != null ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r border-ga-line md:w-[300px]`}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <GaCap>Hội thoại</GaCap>
            {totalUnread > 0 && (
              <span className="rounded-full bg-ga-accent px-2 py-0.5 text-[11px] font-bold text-ga-accent-ink">
                {totalUnread}
              </span>
            )}
          </div>
          {headerAction?.(openThread)}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingConvos ? (
            <LoadingState label="Đang tải hội thoại…" />
          ) : conversations.length === 0 ? (
            <p className="ga-ui px-4 py-8 text-center text-[13px] text-ga-muted">
              {emptyText ?? 'Chưa có hội thoại. Mở từ trang lớp/gia sư để nhắn tin với giáo viên/học viên.'}
            </p>
          ) : (
            conversations.map((c) => {
              const on = c.userId === activeId
              return (
                <button
                  key={c.userId}
                  type="button"
                  onClick={() => openConversation(c)}
                  className={`flex w-full items-center gap-3 border-b border-ga-line px-4 py-3 text-left transition-colors hover:bg-ga-surface ${on ? 'bg-ga-side-active' : ''}`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ga-accent-soft text-[14px] font-bold text-ga-accent">
                    {initial(c.displayName || c.email)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[14px] font-semibold text-ga-ink">{c.displayName || c.email || `#${c.userId}`}</span>
                      <span className="shrink-0 text-[11px] text-ga-subtle">{fmtTime(c.lastAt)}</span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12.5px] text-ga-muted">{c.lastMessage || '—'}</span>
                      {c.unread > 0 && (
                        <span className="shrink-0 rounded-full bg-ga-accent px-1.5 text-[10px] font-bold text-ga-accent-ink">{c.unread}</span>
                      )}
                    </span>
                  </span>
                </button>
              )
            })
          )}
        </div>
      </aside>

      {/* Thread */}
      <section className={`${activeId == null ? 'hidden md:flex' : 'flex'} min-h-0 flex-1 flex-col`}>
        {activeId == null ? (
          <div className="ga-ui flex flex-1 items-center justify-center px-6 text-center text-[14px] text-ga-muted">
            Chọn một hội thoại để bắt đầu nhắn tin.
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-ga-line px-4 py-3">
              <button type="button" onClick={() => setActiveId(null)} className="md:hidden" aria-label="Quay lại">
                <ArrowLeft size={18} className="text-ga-muted" />
              </button>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ga-accent-soft text-[13px] font-bold text-ga-accent">
                {initial(activeName)}
              </span>
              <span className="truncate text-[15px] font-semibold text-ga-ink">{activeName || `Người dùng #${activeId}`}</span>
            </header>

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {loadingThread ? (
                <LoadingState label="Đang tải tin nhắn…" />
              ) : thread.length === 0 ? (
                <p className="ga-ui py-8 text-center text-[13px] text-ga-muted">Chưa có tin nhắn — gửi lời chào đầu tiên 👋</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {thread.map((m) => (
                    <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className="max-w-[78%] rounded-ga px-3.5 py-2"
                        style={
                          m.mine
                            ? { background: 'var(--ga-accent)', color: 'var(--ga-accent-ink)' }
                            : { background: 'var(--ga-card)', border: '1px solid var(--ga-line)', color: 'var(--ga-ink)' }
                        }
                      >
                        <p className="whitespace-pre-wrap break-words text-[14px] leading-snug">{m.body}</p>
                        <p className="ga-ui mt-1 text-right text-[10px] opacity-70">{fmtDay(m.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-end gap-2 border-t border-ga-line px-4 py-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send()
                  }
                }}
                rows={1}
                placeholder="Nhập tin nhắn… (Enter để gửi, Shift+Enter xuống dòng)"
                className="ga-ui max-h-32 min-h-[40px] flex-1 resize-none rounded-ga border border-ga-line bg-ga-bg px-3.5 py-2 text-[14px] text-ga-ink outline-none focus:border-ga-accent"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || !draft.trim()}
                aria-label="Gửi"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-ga bg-ga-accent text-ga-accent-ink transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <Send size={17} />
              </button>
            </div>
          </>
        )}
        {error && <p className="ga-ui px-4 py-2 text-[12px] text-ga-red">{error}</p>}
      </section>
    </div>
  )
}
