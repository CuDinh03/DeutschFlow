'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { getAvailability, putAvailability, type AvailabilitySlot } from '@/lib/teacherAvailabilityApi'
import { GaBtn, GaCap } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// "Khung giờ rảnh" — lưới recurring availability để học viên đặt buổi 1:1.
// Thuộc mục "Buổi học 1:1" (marketplace B2C); GET/PUT /api/v2/teacher/availability.
// 0 = Monday … 6 = Sunday (khớp field `day` của backend).
// ─────────────────────────────────────────────────────────────────────────────

const VIOLET = '#7C56C8'
const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const pad2 = (n: number) => String(n).padStart(2, '0')
const AV_HOURS = Array.from({ length: 16 }, (_, i) => i + 6) // 06:00 … 21:00
const avKey = (day: number, hour: number) => `${day}:${hour}`

function expand(slots: AvailabilitySlot[]): Set<string> {
  const cells = new Set<string>()
  for (const slot of slots) {
    const startHour = parseInt(slot.start.slice(0, 2), 10)
    const endMinute = parseInt(slot.end.slice(3, 5), 10)
    const endHour = parseInt(slot.end.slice(0, 2), 10) + (endMinute > 0 ? 1 : 0)
    for (let h = startHour; h < endHour; h++) {
      if (h >= AV_HOURS[0] && h <= AV_HOURS[AV_HOURS.length - 1]) cells.add(avKey(slot.day, h))
    }
  }
  return cells
}

function coalesce(cells: Set<string>): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = []
  for (let day = 0; day < 7; day++) {
    const hours = AV_HOURS.filter((h) => cells.has(avKey(day, h))).sort((a, b) => a - b)
    let i = 0
    while (i < hours.length) {
      const start = hours[i]
      let end = start
      while (i + 1 < hours.length && hours[i + 1] === end + 1) end = hours[++i]
      slots.push({ day, start: `${pad2(start)}:00`, end: `${pad2(end + 1)}:00` })
      i++
    }
  }
  return slots
}

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && Array.from(a).every((k) => b.has(k))

export function AvailabilityPanel() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [baseline, setBaseline] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const cells = expand(await getAvailability())
      setSelected(cells)
      setBaseline(cells)
    } catch (e: unknown) {
      setError(true)
      toast.error(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const dirty = useMemo(() => !sameSet(selected, baseline), [selected, baseline])
  const blockCount = selected.size

  const toggle = (day: number, hour: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      const k = avKey(day, hour)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

  const save = async () => {
    setSaving(true)
    try {
      const stored = await putAvailability(coalesce(selected))
      const cells = expand(stored)
      setSelected(cells)
      setBaseline(cells)
      toast.success('Đã lưu khung giờ rảnh')
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (error) {
    return (
      <div className="border border-dashed border-ga-line px-10 py-[52px] text-center">
        <div className="font-ga-display text-[20px] italic text-ga-muted">Không tải được khung giờ rảnh</div>
        <p className="ga-ui mx-auto mb-4 mt-2 max-w-sm text-[13.5px] text-ga-subtle">Có lỗi khi tải khung giờ. Thử lại nhé.</p>
        <GaBtn variant="ghost" onClick={() => void load()}>
          Thử lại
        </GaBtn>
      </div>
    )
  }

  return (
    <div className="border border-ga-line bg-ga-card px-8 py-7">
      <div className="mb-[18px] flex items-center justify-between gap-4">
        <div>
          <GaCap>Chọn khung giờ rảnh trong tuần</GaCap>
          <p className="mt-1 text-[12.5px] text-ga-subtle">Học viên đặt buổi 1:1 trong các khung này. Lịch lặp lại mỗi tuần.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="text-[13px] text-ga-muted">{loading ? 'Đang tải…' : `${blockCount} khung giờ`}</span>
          <GaBtn variant="ghost" disabled={loading || saving || blockCount === 0} onClick={() => setSelected(new Set())}>
            Xoá hết
          </GaBtn>
          <GaBtn variant="yellow" disabled={loading || saving || !dirty} onClick={save}>
            {saving ? 'Đang lưu…' : 'Lưu lịch'}
          </GaBtn>
        </div>
      </div>

      <div
        aria-hidden={loading}
        className={loading ? 'pointer-events-none opacity-40' : ''}
        style={{ display: 'grid', gridTemplateColumns: '64px repeat(7, minmax(0, 1fr))', gap: '4px' }}
      >
        <div />
        {DAYS.map((d) => (
          <div key={d} className="pb-1 text-center text-[11.5px] font-bold text-ga-ink">
            {d}
          </div>
        ))}

        {AV_HOURS.map((h) => (
          <div key={h} className="contents">
            <div className="flex items-center justify-end pr-2 text-[11px] font-semibold text-ga-muted">{pad2(h)}:00</div>
            {DAYS.map((_, day) => {
              const on = selected.has(avKey(day, h))
              return (
                <button
                  key={avKey(day, h)}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${DAYS[day]} ${pad2(h)}:00`}
                  onClick={() => toggle(day, h)}
                  className="h-[34px] rounded-ga border text-[12px] font-bold transition-colors"
                  style={{
                    borderColor: on ? VIOLET : 'var(--ga-line)',
                    background: on ? 'var(--ga-violet-soft)' : 'transparent',
                    color: on ? VIOLET : 'var(--ga-faint)',
                  }}
                >
                  {on ? '✓' : ''}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
