'use client'

import { useEffect, useRef, useState } from 'react'
import { Clock, Hourglass } from 'lucide-react'

interface Props {
  /** ISO deadline từ server. */
  deadlineAt: string | null
  /** ISO serverNow đi kèm snapshot — để bù lệch đồng hồ client/server. */
  serverNow: string
  totalSec: number
  onExpire?: () => void
  label: string
  /** `pill`: kiểu thanh trên phòng thi nói (mẫu 07/11/2026); mặc định `box` cho màn chuẩn bị. */
  variant?: 'box' | 'pill'
  /** `prep`: đồng hồ giờ chuẩn bị — nền cam suốt (mẫu 07/11/2026). */
  tone?: 'default' | 'prep'
}

/** Đồng hồ đếm ngược theo giờ SERVER (client chỉ hiển thị); đổi màu ở 20% cuối; gọi onExpire một lần. */
export function ExamTimer({ deadlineAt, serverNow, totalSec, onExpire, label, variant = 'box', tone = 'default' }: Props) {
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
  if (variant === 'pill') {
    // Thanh trên phòng thi nói: còn 20% cuối nền cam, còn 30 giây nền đỏ nhấp nháy nhẹ.
    const danger = left <= 30
    return (
      <span
        className={`ga-ui inline-flex shrink-0 items-center gap-1.5 rounded-ga-pill px-2.5 py-1 text-ga-body font-semibold tabular-nums transition-colors duration-[240ms] ${
          danger ? 'ga-timer-pulse bg-ga-red-soft text-ga-red' : warn || tone === 'prep' ? 'bg-ga-warning-soft text-ga-warning' : 'text-ga-ink'
        }`}
        role="timer"
        aria-live={warn ? 'assertive' : 'off'}
        data-testid="exam-timer"
      >
        {tone === 'prep' ? <Hourglass size={16} aria-hidden /> : <Clock size={16} aria-hidden />}
        <span className="sr-only">{label}</span>
        {mm}:{ss}
      </span>
    )
  }
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
