'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiMessage } from '@/lib/api'
import { getThread, sendMessage, type ChatMessage } from '@/lib/messagesApi'
import { LoadingState } from '@/components/ui-v2'
import { Composer } from './Composer'
import { ThreadShell, fmtDay, initial } from './ThreadShell'

/** Active thread refresh cadence — snappier than the list so an incoming reply appears near-live. */
const POLL_MS = 5_000

interface DirectThreadProps {
  userId: number
  name: string
  onBack: () => void
  /** Refresh the conversation list after sending (updates preview + ordering). */
  onSent: () => void
}

/** 1-1 student ↔ teacher thread. Fetching also marks incoming messages read server-side. */
export function DirectThread({ userId, name, onBack, onSent }: DirectThreadProps) {
  const [thread, setThread] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (spin: boolean) => {
    if (spin) setLoading(true)
    try {
      setThread(await getThread(userId))
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      if (spin) setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load(true)
    const t = setInterval(() => void load(false), POLL_MS)
    return () => clearInterval(t)
  }, [load])

  const send = async (text: string) => {
    try {
      const msg = await sendMessage(userId, text)
      setThread((t) => [...t, msg])
      setError('')
      onSent()
    } catch (e: unknown) {
      setError(apiMessage(e))
      throw e
    }
  }

  return (
    <ThreadShell
      avatar={
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ga-accent-soft text-[13px] font-bold text-ga-accent">
          {initial(name)}
        </span>
      }
      title={name || `Người dùng #${userId}`}
      onBack={onBack}
      scrollKey={`${userId}:${thread.length}`}
      error={error}
      footer={
        <Composer placeholder="Nhập tin nhắn… (Enter để gửi, Shift+Enter xuống dòng)" onSend={send} />
      }
    >
      {loading ? (
        <LoadingState label="Đang tải tin nhắn…" />
      ) : thread.length === 0 ? (
        <p className="ga-ui py-8 text-center text-[13px] text-ga-muted">
          Chưa có tin nhắn — gửi lời chào đầu tiên 👋
        </p>
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
    </ThreadShell>
  )
}
