'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExamPlanDay } from '@/lib/examPlanApi'
import { dayIcon } from './visual'

interface Props {
  days: ExamPlanDay[]
  /** Nhãn ngắn của buổi ("Lesen T2", "Thi thử", "Nghỉ"). */
  labelOf: (day: ExamPlanDay) => string
  /** Đổi chỗ hai ngày; trả về khi máy chủ đã lưu (lỗi thì ném). */
  onSwap: (from: string, to: string) => Promise<void>
}

/**
 * Lịch tuần (màn Hôm nay): bảy ô ngày, mỗi ô một buổi. Buổi chưa làm và chưa qua đổi chỗ được: kéo
 * thả bằng chuột, hoặc bấm hai buổi (cảm ứng, bàn phím). Buổi đã làm khoá, có dấu tích. Hai ô vừa đổi
 * loé vàng một lần. Esc bỏ buổi đang chọn.
 */
export function WeekPlan({ days, labelOf, onSwap }: Props) {
  const t = useTranslations('v2.student.examHub')
  const [picked, setPicked] = React.useState<string | null>(null)
  const [dragFrom, setDragFrom] = React.useState<string | null>(null)
  const [over, setOver] = React.useState<string | null>(null)
  const [flash, setFlash] = React.useState<string[]>([])
  const [busy, setBusy] = React.useState(false)

  const swap = async (a: string, b: string) => {
    setPicked(null)
    if (a === b || busy) return
    setBusy(true)
    try {
      await onSwap(a, b)
      setFlash([a, b])
      window.setTimeout(() => setFlash([]), 450)
    } catch {
      /* trang đã báo lỗi và trả lịch cũ */
    } finally {
      setBusy(false)
    }
  }

  React.useEffect(() => {
    if (!picked) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPicked(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picked])

  return (
    <ol className="grid grid-cols-4 gap-2 sm:grid-cols-7" aria-busy={busy || undefined}>
      {days.map((d) => {
        const Icon = dayIcon(d)
        const weekday = t(`wd.${new Date(`${d.date}T00:00:00`).getDay()}`)
        const label = labelOf(d)
        const done = d.status === 'DONE'
        const cls = cn(
          'ga-ui flex min-h-[76px] w-full min-w-0 flex-col gap-1.5 rounded-ga border px-2 py-2.5 text-left text-ga-caption transition-[border-color,background-color,transform,opacity] duration-150',
          done && 'border-transparent bg-ga-side-active',
          !done && !d.movable && 'border-ga-line',
          d.movable && 'cursor-grab border-ga-line bg-ga-card hover:border-ga-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus',
          d.status === 'TODAY' && 'border-[1.5px] border-ga-ink',
          d.status === 'MISSED' && 'border-dashed',
          picked === d.date && '-translate-y-0.5 border-[1.5px] border-ga-yellow bg-ga-yellow-soft',
          over === d.date && 'border-[1.5px] border-dashed border-ga-ink',
          dragFrom === d.date && 'opacity-40',
          flash.includes(d.date) && 'ga-day-flash',
        )
        const body = (
          <>
            <span className="flex items-center justify-between text-ga-small font-bold text-ga-ink">
              {weekday}
              {done && <Check size={14} className="text-ga-green" aria-hidden />}
            </span>
            <span className={cn('flex min-w-0 items-start gap-1.5', done ? 'text-ga-muted' : d.movable ? 'text-ga-ink' : 'text-ga-subtle')}>
              <Icon size={14} className="mt-px shrink-0" aria-hidden />
              <span lang="de" className={cn('line-clamp-2 min-w-0 break-words', done && 'line-through')}>{label}</span>
            </span>
          </>
        )
        const aria = t('dayAria', { day: weekday, label, status: t(`dayStatus.${d.status}`) })
        return (
          <li key={d.date} className="min-w-0">
            {d.movable ? (
              <button
                type="button"
                draggable
                aria-label={aria}
                aria-pressed={picked === d.date}
                title={t('swapHint')}
                className={cls}
                onClick={() => (picked ? void swap(picked, d.date) : setPicked(d.date))}
                onDragStart={(e) => {
                  setDragFrom(d.date)
                  e.dataTransfer.effectAllowed = 'move'
                  try {
                    e.dataTransfer.setData('text/plain', d.date)
                  } catch {
                    /* một số trình duyệt chặn setData */
                  }
                }}
                onDragEnd={() => {
                  setDragFrom(null)
                  setOver(null)
                }}
                onDragOver={(e) => {
                  if (dragFrom && dragFrom !== d.date) {
                    e.preventDefault()
                    setOver(d.date)
                  }
                }}
                onDragLeave={() => setOver((o) => (o === d.date ? null : o))}
                onDrop={(e) => {
                  e.preventDefault()
                  const from = dragFrom
                  setOver(null)
                  setDragFrom(null)
                  if (from && from !== d.date) void swap(from, d.date)
                }}
              >
                {body}
              </button>
            ) : (
              <div className={cls} aria-label={aria} role="group">
                {body}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
