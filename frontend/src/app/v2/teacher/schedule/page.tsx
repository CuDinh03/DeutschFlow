'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { getAvailability, putAvailability, type AvailabilitySlot } from '@/lib/teacherAvailabilityApi'
import { GaPageHdr, GaBtn, GaCap } from '@/components/ui-v2'

const VIOLET = '#7C56C8'
// 0 = Monday … 6 = Sunday (matches the backend `day` field).
const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
// Hour blocks the grid offers: 06:00–07:00 … 21:00–22:00.
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6)
const pad = (h: number) => String(h).padStart(2, '0')
const key = (day: number, hour: number) => `${day}:${hour}`

/** Expand stored slots into the set of selected hour-cells (rounds non-hour-aligned legacy data). */
function expand(slots: AvailabilitySlot[]): Set<string> {
  const cells = new Set<string>()
  for (const slot of slots) {
    const startHour = parseInt(slot.start.slice(0, 2), 10)
    const endMinute = parseInt(slot.end.slice(3, 5), 10)
    const endHour = parseInt(slot.end.slice(0, 2), 10) + (endMinute > 0 ? 1 : 0)
    for (let h = startHour; h < endHour; h++) {
      if (h >= HOURS[0] && h <= HOURS[HOURS.length - 1]) cells.add(key(slot.day, h))
    }
  }
  return cells
}

/** Coalesce selected hour-cells into contiguous {day, start, end} slots, per day. */
function coalesce(cells: Set<string>): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = []
  for (let day = 0; day < 7; day++) {
    const hours = HOURS.filter((h) => cells.has(key(day, h))).sort((a, b) => a - b)
    let i = 0
    while (i < hours.length) {
      const start = hours[i]
      let end = start
      while (i + 1 < hours.length && hours[i + 1] === end + 1) end = hours[++i]
      slots.push({ day, start: `${pad(start)}:00`, end: `${pad(end + 1)}:00` })
      i++
    }
  }
  return slots
}

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && Array.from(a).every((k) => b.has(k))

export default function V2TeacherSchedulePage() {
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
      const k = key(day, hour)
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
      toast.success('Đã lưu lịch dạy')
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title="Lịch dạy"
        subtitle="Khung giờ rảnh hằng tuần — học viên đặt buổi 1:1 trong các khung này"
        right={
          <div className="flex gap-2.5">
            <GaBtn variant="ghost" disabled={loading || saving || blockCount === 0} onClick={() => setSelected(new Set())}>
              Xoá hết
            </GaBtn>
            <GaBtn variant="yellow" disabled={loading || saving || !dirty} onClick={save}>
              {saving ? 'Đang lưu…' : 'Lưu lịch'}
            </GaBtn>
          </div>
        }
      />

      <div className="flex-1 overflow-auto px-10 py-7">
        {error ? (
          <div className="border border-dashed border-ga-line px-10 py-[52px] text-center">
            <div className="font-ga-display text-[20px] italic text-ga-muted">Không tải được lịch dạy</div>
            <p className="ga-ui mx-auto mb-4 mt-2 max-w-sm text-[13.5px] text-ga-subtle">
              Có lỗi khi tải khung giờ. Thử lại nhé.
            </p>
            <GaBtn variant="ghost" onClick={() => void load()}>
              Thử lại
            </GaBtn>
          </div>
        ) : (
          <div className="border border-ga-line bg-ga-card px-8 py-7">
            <div className="mb-[18px] flex items-center justify-between">
              <GaCap>Chọn khung giờ rảnh trong tuần</GaCap>
              <span className="text-[13px] text-ga-muted">
                {loading ? 'Đang tải…' : `${blockCount} khung giờ`}
              </span>
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

              {HOURS.map((h) => (
                <div key={h} className="contents">
                  <div className="flex items-center justify-end pr-2 text-[11px] font-semibold text-ga-muted">
                    {pad(h)}:00
                  </div>
                  {DAYS.map((_, day) => {
                    const on = selected.has(key(day, h))
                    return (
                      <button
                        key={key(day, h)}
                        type="button"
                        aria-pressed={on}
                        aria-label={`${DAYS[day]} ${pad(h)}:00`}
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

            <p className="mt-5 border-t border-ga-line pt-4 text-[11.5px] text-ga-subtle">
              Lịch lặp lại mỗi tuần. Nhấn vào ô để bật/tắt khung giờ, rồi bấm “Lưu lịch”.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
