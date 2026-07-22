'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { ArrowLeft, Send, Trash2, Users } from 'lucide-react'
import { apiMessage } from '@/lib/api'
import {
  listTeacherClasses,
  type TeacherClass,
} from '@/lib/teacherMessagingApi'
import {
  listClassMessages,
  postClassMessage,
  deleteClassMessage,
  type ClassMessage,
} from '@/lib/classChannelApi'
import { GaCap, LoadingState } from '@/components/ui-v2'

const POLL_MS = 12_000
const fmtDay = (d: string | null | undefined) => (d ? format(new Date(d), 'dd/MM HH:mm') : '')

/**
 * Class group-channel surface for teachers: a list of the teacher's classes (left) and the shared
 * channel thread + composer (right). Every class member (students + teachers) reads and posts the
 * same feed; teachers may soft-delete any message. Mirrors {@link MessagesView}'s two-pane layout.
 */
export function ClassChannelView() {
  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [activeName, setActiveName] = useState<string | null>(null)
  const [messages, setMessages] = useState<ClassMessage[]>([])
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const loadClasses = useCallback(async () => {
    try {
      const list = await listTeacherClasses()
      setClasses(list)
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoadingClasses(false)
    }
  }, [])

  const loadMessages = useCallback(async (classId: number, spin: boolean) => {
    if (spin) setLoadingThread(true)
    try {
      setMessages(await listClassMessages(classId))
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      if (spin) setLoadingThread(false)
    }
  }, [])

  useEffect(() => {
    void loadClasses()
  }, [loadClasses])

  // Load + poll the active channel.
  useEffect(() => {
    if (activeId == null) {
      setMessages([])
      return
    }
    void loadMessages(activeId, true)
    const t = setInterval(() => void loadMessages(activeId, false), POLL_MS)
    return () => clearInterval(t)
  }, [activeId, loadMessages])

  // Keep the channel scrolled to the newest message.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, activeId])

  const openClass = (c: TeacherClass) => {
    setActiveId(c.id)
    setActiveName(c.name)
  }

  const send = async () => {
    const text = draft.trim()
    if (!text || activeId == null) return
    setSending(true)
    try {
      const msg = await postClassMessage(activeId, text)
      setMessages((m) => [...m, msg])
      setDraft('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setSending(false)
    }
  }

  const remove = async (messageId: number) => {
    if (activeId == null) return
    try {
      const updated = await deleteClassMessage(activeId, messageId)
      setMessages((m) => m.map((x) => (x.id === updated.id ? updated : x)))
    } catch (e: unknown) {
      setError(apiMessage(e))
    }
  }

  return (
    <div className="flex min-h-0 flex-1 border-t border-ga-line">
      {/* Class list */}
      <aside
        className={`${activeId != null ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r border-ga-line md:w-[300px]`}
      >
        <div className="flex items-center gap-2 px-4 py-3">
          <GaCap>Lớp học</GaCap>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingClasses ? (
            <LoadingState label="Đang tải lớp…" />
          ) : classes.length === 0 ? (
            <p className="ga-ui px-4 py-8 text-center text-[13px] text-ga-muted">
              Bạn chưa có lớp nào. Tạo lớp để mở kênh chat nhóm.
            </p>
          ) : (
            classes.map((c) => {
              const on = c.id === activeId
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openClass(c)}
                  className={`flex w-full items-center gap-3 border-b border-ga-line px-4 py-3 text-left transition-colors hover:bg-ga-surface ${on ? 'bg-ga-side-active' : ''}`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ga-accent-soft text-ga-accent">
                    <Users size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-ga-ink">{c.name}</span>
                    <span className="block truncate text-[12.5px] text-ga-muted">
                      {c.studentCount} học viên
                    </span>
                  </span>
                </button>
              )
            })
          )}
        </div>
      </aside>

      {/* Channel thread */}
      <section className={`${activeId == null ? 'hidden md:flex' : 'flex'} min-h-0 flex-1 flex-col`}>
        {activeId == null ? (
          <div className="ga-ui flex flex-1 items-center justify-center px-6 text-center text-[14px] text-ga-muted">
            Chọn một lớp để nhắn tin cho cả nhóm.
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-ga-line px-4 py-3">
              <button type="button" onClick={() => setActiveId(null)} className="-ml-1 grid h-10 w-10 shrink-0 place-items-center md:hidden" aria-label="Quay lại">
                <ArrowLeft size={18} className="text-ga-muted" />
              </button>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ga-accent-soft text-ga-accent">
                <Users size={16} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold text-ga-ink">{activeName || `Lớp #${activeId}`}</span>
                <span className="ga-ui block text-[11px] text-ga-subtle">Kênh chat cả lớp</span>
              </span>
            </header>

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {loadingThread ? (
                <LoadingState label="Đang tải tin nhắn…" />
              ) : messages.length === 0 ? (
                <p className="ga-ui py-8 text-center text-[13px] text-ga-muted">
                  Chưa có tin nhắn — gửi thông báo đầu tiên cho cả lớp 📣
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {messages.map((m) => (
                    <div key={m.id} className={`group flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex max-w-[80%] items-end gap-1.5 ${m.mine ? 'flex-row-reverse' : ''}`}>
                        <div
                          className="rounded-ga px-3.5 py-2"
                          style={
                            m.deleted
                              ? { background: 'var(--ga-surface)', border: '1px dashed var(--ga-line)', color: 'var(--ga-muted)' }
                              : m.mine
                                ? { background: 'var(--ga-accent)', color: 'var(--ga-accent-ink)' }
                                : { background: 'var(--ga-card)', border: '1px solid var(--ga-line)', color: 'var(--ga-ink)' }
                          }
                        >
                          {!m.mine && !m.deleted && (
                            <p className="ga-ui mb-0.5 text-[11px] font-semibold text-ga-accent">{m.senderName}</p>
                          )}
                          {m.deleted ? (
                            <p className="text-[13px] italic">Tin đã xoá</p>
                          ) : (
                            <p className="whitespace-pre-wrap break-words text-[14px] leading-snug">{m.body}</p>
                          )}
                          <p className="ga-ui mt-1 text-right text-[10px] opacity-70">{fmtDay(m.createdAt)}</p>
                        </div>
                        {m.canDelete && (
                          <button
                            type="button"
                            onClick={() => void remove(m.id)}
                            aria-label="Xoá tin nhắn"
                            className="mb-1 shrink-0 rounded-ga p-1 text-ga-subtle opacity-0 transition-opacity hover:text-ga-red group-hover:opacity-100"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
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
                placeholder="Nhắn cả lớp… (Enter để gửi, Shift+Enter xuống dòng)"
                className="ga-ui max-h-32 min-h-[40px] w-full min-w-0 flex-1 resize-none rounded-ga border border-ga-line bg-ga-bg px-3.5 py-2 text-[14px] text-ga-ink outline-none focus:border-ga-accent"
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
