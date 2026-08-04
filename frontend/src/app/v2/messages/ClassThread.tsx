'use client'

import { useCallback, useEffect, useState } from 'react'
import { Trash2, Users } from 'lucide-react'
import { apiMessage } from '@/lib/api'
import {
  listClassMessages,
  postClassMessage,
  deleteClassMessage,
  type ClassMessage,
} from '@/lib/classChannelApi'
import { LoadingState } from '@/components/ui-v2'
import { Composer } from './Composer'
import { ThreadShell, fmtDay } from './ThreadShell'

/**
 * Channel refresh cadence. Slower than the direct thread: a class feed is broadcast-shaped
 * (announcements, not back-and-forth) and every member polls the same endpoint.
 */
const POLL_MS = 12_000

interface ClassThreadProps {
  classId: number
  name: string
  onBack: () => void
}

/**
 * Class group channel — every member (enrolled students + the class's teachers) reads and posts the
 * same feed. Membership is re-verified server-side on every call, so this component is role-agnostic:
 * `mine` drives bubble alignment and `canDelete` drives the delete affordance, both from the server.
 *
 * Opening the channel also clears the class's `CLASS_CHANNEL_MESSAGE` notifications — the backend
 * auto-acks them on read, since the channel has no read-state of its own.
 */
export function ClassThread({ classId, name, onBack }: ClassThreadProps) {
  const [messages, setMessages] = useState<ClassMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (spin: boolean) => {
    if (spin) setLoading(true)
    try {
      setMessages(await listClassMessages(classId))
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      if (spin) setLoading(false)
    }
  }, [classId])

  useEffect(() => {
    void load(true)
    const t = setInterval(() => void load(false), POLL_MS)
    return () => clearInterval(t)
  }, [load])

  const send = async (text: string) => {
    try {
      const msg = await postClassMessage(classId, text)
      setMessages((m) => [...m, msg])
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
      throw e
    }
  }

  const remove = async (messageId: number) => {
    try {
      const updated = await deleteClassMessage(classId, messageId)
      setMessages((m) => m.map((x) => (x.id === updated.id ? updated : x)))
    } catch (e: unknown) {
      setError(apiMessage(e))
    }
  }

  return (
    <ThreadShell
      avatar={
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ga-accent-soft text-ga-accent">
          <Users size={16} />
        </span>
      }
      title={name || `Lớp #${classId}`}
      caption="Kênh chat cả lớp"
      onBack={onBack}
      scrollKey={`${classId}:${messages.length}`}
      error={error}
      footer={
        <Composer placeholder="Nhắn cả lớp… (Enter để gửi, Shift+Enter xuống dòng)" onSend={send} />
      }
    >
      {loading ? (
        <LoadingState label="Đang tải tin nhắn…" />
      ) : messages.length === 0 ? (
        <p className="ga-ui py-8 text-center text-[13px] text-ga-muted">
          Chưa có tin nhắn nào trong lớp này.
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
                    className="mb-1 shrink-0 rounded-ga p-1 text-ga-subtle opacity-0 transition-opacity hover:text-ga-red group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </ThreadShell>
  )
}
