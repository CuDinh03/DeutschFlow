'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, PlayCircle, Lightbulb } from 'lucide-react'
import { format } from 'date-fns'
import { apiMessage } from '@/lib/api'
import { fetchMyClasses, fetchClassLessons, type MyClassroom, type ClassLesson } from '@/lib/studentClassesApi'
import { GaPageHdr, GaBtn, GaCap } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Tiến độ khóa học — học viên (GaStProgress, proto-checklist.jsx) — yellow,
// read-only. Plumbing reused 1:1 (zero backend): fetchMyClasses (class picker) +
// fetchClassLessons (flat ClassLesson[], teacher-updated). Option-1: proto's
// personal self-tick tasks + module/milestone grouping are fictional (lessons are
// FLAT, no personal-task storage) → dropped → class progress hero + lesson timeline,
// mirroring the teacher tc-progress view. Progress is teacher-updated; student views.
// ─────────────────────────────────────────────────────────────────────────────

const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')

export default function V2StProgressPage() {
  const [classes, setClasses] = useState<MyClassroom[]>([])
  const [selId, setSelId] = useState<number | null>(null)
  const [lessons, setLessons] = useState<ClassLesson[]>([])
  const [loading, setLoading] = useState(true)
  const [lessonsLoading, setLessonsLoading] = useState(false)
  const [error, setError] = useState('')

  const loadClasses = useCallback(async () => {
    setLoading(true)
    try {
      const cs = await fetchMyClasses()
      setClasses(cs)
      setSelId((prev) => prev ?? cs[0]?.id ?? null)
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadClasses() }, [loadClasses])

  useEffect(() => {
    if (selId == null) return
    setLessonsLoading(true)
    fetchClassLessons(selId)
      .then(setLessons)
      .catch(() => setLessons([]))
      .finally(() => setLessonsLoading(false))
  }, [selId])

  const sel = classes.find((c) => c.id === selId) ?? null
  const total = lessons.length
  const done = useMemo(() => lessons.filter((l) => l.completed).length, [lessons])
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const currentIdx = lessons.findIndex((l) => !l.completed)
  const current = currentIdx >= 0 ? lessons[currentIdx] : null
  const next = currentIdx >= 0 && currentIdx + 1 < lessons.length ? lessons[currentIdx + 1] : null

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title="Tiến độ khóa học" subtitle="Theo dõi lộ trình lớp do giáo viên cập nhật" />

      <div className="flex-1 overflow-auto px-10 py-7">
        {loading ? (
          <div className="ga-shimmer h-[160px] border border-ga-line" aria-hidden />
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">Không tải được tiến độ</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">{error}</p>
            <GaBtn variant="primary" onClick={loadClasses}>Thử lại</GaBtn>
          </div>
        ) : classes.length === 0 ? (
          <div className="border border-dashed border-ga-line px-10 py-[44px] text-center text-[14.5px] text-ga-muted">Bạn chưa tham gia lớp nào để theo dõi tiến độ.</div>
        ) : (
          <>
            {/* Class picker */}
            <div className="mb-6 flex items-center gap-3">
              <GaCap>Lớp</GaCap>
              <select
                value={selId ?? ''}
                onChange={(e) => setSelId(Number(e.target.value))}
                className="ga-ui border border-ga-line bg-ga-card px-3.5 py-2 text-[14px] font-semibold text-ga-ink outline-none"
              >
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Progress hero (dark) */}
            <div className="bg-ga-ink p-7 text-ga-bg">
              <GaCap className="mb-2.5 block" style={{ color: '#A39E94' }}>Tiến độ lớp · {sel?.name}</GaCap>
              <div className="flex items-end gap-3">
                <span className="font-ga-display text-[52px] font-medium leading-none">{pct}%</span>
                <span className="mb-1.5 text-[14px]" style={{ color: '#A39E94' }}>{done}/{total} bài học · do giáo viên cập nhật</span>
              </div>
              <div className="mt-4 h-2.5 overflow-hidden bg-white/15"><div className="h-full transition-[width] duration-500" style={{ width: `${pct}%`, background: 'var(--ga-yellow)' }} /></div>
            </div>

            {/* Now learning callout */}
            {current && (
              <div className="mt-3.5 flex items-center gap-3.5 border border-l-4 p-[14px_18px]" style={{ background: 'rgba(47,111,201,0.08)', borderColor: 'rgba(47,111,201,0.27)', borderLeftColor: '#2F6FC9' }}>
                <PlayCircle size={26} style={{ color: '#2F6FC9' }} />
                <div className="flex-1">
                  <div className="ga-ui text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: '#2F6FC9' }}>Lớp đang học</div>
                  <div className="mt-0.5 font-ga-display text-[18px] font-medium text-ga-ink">{current.title}</div>
                </div>
                <span className="text-[12.5px] text-ga-muted">Tiếp theo: {next?.title ?? 'Ôn tập & thi'}</span>
              </div>
            )}

            {/* Lesson timeline */}
            <GaCap className="mb-3 mt-6 block">Lộ trình khóa học ({done}/{total} đã dạy)</GaCap>
            {lessonsLoading ? (
              <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="ga-shimmer h-[56px] border border-ga-line" aria-hidden />)}</div>
            ) : lessons.length === 0 ? (
              <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">Giáo viên chưa thêm bài học nào cho lớp này.</div>
            ) : (
              <div className="border border-ga-line bg-ga-card">
                {lessons.map((l, i) => {
                  const isCurrent = i === currentIdx
                  return (
                    <div key={l.id} className="flex items-center gap-3.5 px-5 py-3.5" style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none', background: isCurrent ? 'rgba(47,111,201,0.06)' : 'transparent', borderLeft: isCurrent ? '3px solid #2F6FC9' : '3px solid transparent' }}>
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold" style={l.completed ? { background: 'var(--ga-green-soft)', color: 'var(--ga-green)' } : { background: 'var(--ga-side-active)', color: 'var(--ga-muted)' }}>
                        {l.completed ? <Check size={14} /> : i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14.5px] font-semibold text-ga-ink">{l.title}</div>
                        {l.description && <div className="truncate text-[12.5px] text-ga-muted">{l.description}</div>}
                      </div>
                      <span className="shrink-0 text-[12.5px]" style={{ color: l.completed ? 'var(--ga-green)' : isCurrent ? '#2F6FC9' : 'var(--ga-muted)' }}>
                        {l.completed ? `Đã dạy · ${fmtDate(l.completedAt)}` : isCurrent ? 'Đang học' : 'Chưa dạy'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-4 flex items-center gap-3 border p-[14px_18px]" style={{ background: 'var(--ga-yellow-soft)', borderColor: 'color-mix(in srgb, var(--ga-gold) 40%, transparent)' }}>
              <Lightbulb size={20} style={{ color: 'var(--ga-gold)' }} />
              <div className="text-[13.5px] leading-relaxed text-ga-ink">Tiến độ lớp do <strong>giáo viên cập nhật</strong> — bạn theo dõi để biết lớp đang học đến đâu và chuẩn bị bài kế tiếp.</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
