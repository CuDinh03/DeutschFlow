'use client'

import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'

interface Props {
  /** ISO deadline từ server. */
  deadlineAt: string | null
  /** ISO serverNow đi kèm snapshot — để bù lệch đồng hồ client/server. */
  serverNow: string
  totalSec: number
  onExpire?: () => void
  label: string
}

/** Đồng hồ đếm ngược theo giờ SERVER (client chỉ hiển thị); đổi màu ở 20% cuối; gọi onExpire một lần. */
export function ExamTimer({ deadlineAt, serverNow, totalSec, onExpire, label }: Props) {
  const [left, setLeft] = useState<number | null>(null)
  const expiredRef = useRef(false)
  const offsetRef = useRef(0)

  useEffect(() => {
    offsetRef.current = new Date(serverNow).getTime() - Date.now()
  }, [serverNow])

  useEffect(() => {
    expiredRef.current = false
    if (!deadlineAt) {
      setLeft(null)
      return
    }
    const deadline = new Date(deadlineAt).getTime()
    const tick = () => {
      const now = Date.now() + offsetRef.current
      const remaining = Math.max(0, Math.round((deadline - now) / 1000))
      setLeft(remaining)
      if (remaining === 0 && !expiredRef.current) {
        expiredRef.current = true
        onExpire?.()
      }
    }
    tick()
    const id = window.setInterval(tick, 500)
    return () => window.clearInterval(id)
  }, [deadlineAt, onExpire])

  if (left === null) return null
  const warn = totalSec > 0 && left <= Math.ceil(totalSec * 0.2)
  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-ga border px-3 py-1.5 tabular-nums ${
        warn ? 'border-ga-red bg-ga-red-soft text-ga-red' : 'border-ga-line bg-ga-card text-ga-ink'
      }`}
      role="timer"
      aria-live={warn ? 'assertive' : 'off'}
      data-testid="exam-timer"
    >
      <Clock size={14} aria-hidden />
      <span className="ga-ui text-[12px] text-ga-muted">{label}</span>
      <span className="font-ga-display text-[18px] font-semibold">{mm}:{ss}</span>
    </div>
  )
}
