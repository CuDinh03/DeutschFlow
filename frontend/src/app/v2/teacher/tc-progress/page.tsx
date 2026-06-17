'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { apiMessage } from '@/lib/api'
import { listLessons, type ClassLesson } from '@/lib/teacherLessonsApi'
import { GaPageHdr, GaBtn, GaCap } from '@/components/ui-v2'
import { ClassPicker, useTeacherClasses, pct } from '../tcShared'

const VIOLET = '#7C56C8'

// ─────────────────────────────────────────────────────────────────────────────
// Tiến độ khóa học (GaTcProgress) — violet, read-only per-class progress overview.
// Plumbing reused 1:1 (zero backend): listLessons (`/v2/teacher/classes/{id}/lessons`).
// Option-1: real data is a flat lesson list with a `completed` flag → progress % +
//   completion timeline are real. The proto's EXPECTED-PACE marker ("đúng/chậm tiến độ"),
//   MODULE breakdown, MILESTONES, "buổi đã dạy vs total", and exam-date have no backing →
//   dropped (backlog: course schedule / expected-pace + module grouping). Editable ticking
//   lives on tc-checklist.
// ─────────────────────────────────────────────────────────────────────────────

export default function V2TcProgressPage() {
  const router = useRouter()
  const { classes, classId, setClassId, loadingClasses } = useTeacherClasses()
  const [lessons, setLessons] = useState<ClassLesson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (cid: number) => {
    setLoading(true)
    try {
      setLessons(await listLessons(cid))
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (classId) void load(classId) }, [classId, load])

  const ordered = useMemo(() => [...lessons].sort((a, b) => a.orderIndex - b.orderIndex), [lessons])
  const done = lessons.filter((l) => l.completed)
  const progress = pct(lessons)
  const lastDone = [...done].sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime())[0]
  const next = ordered.find((l) => !l.completed)

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title="Tiến độ khóa học"
        subtitle="Tổng quan tiến độ giảng dạy theo lớp"
        right={
          <div className="flex items-center gap-3">
            <ClassPicker classes={classes} classId={classId} onChange={setClassId} disabled={loadingClasses} />
            <GaBtn variant="yellow" size="sm" onClick={() => router.push('/v2/teacher/tc-checklist')}>Mở checklist</GaBtn>
          </div>
        }
      />

      <div className="flex-1 overflow-auto px-10 py-6">
        {loading ? (
          <div className="ga-shimmer h-[180px] border border-ga-line" aria-hidden />
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">Không tải được tiến độ</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">{error}</p>
            <GaBtn variant="primary" onClick={() => classId && load(classId)}>Thử lại</GaBtn>
          </div>
        ) : lessons.length === 0 ? (
          <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">
            Lớp chưa có bài học nào. <button type="button" onClick={() => router.push('/v2/teacher/tc-checklist')} className="font-semibold underline" style={{ color: VIOLET }}>Thêm bài trong checklist →</button>
          </div>
        ) : (
          <>
            {/* Hero */}
            <div className="grid items-center gap-9 bg-ga-ink px-[30px] py-7 text-ga-bg lg:grid-cols-[1.5fr_1fr]">
              <div>
                {next ? (
                  <div className="mb-3.5 flex items-center gap-2.5">
                    <span className="ga-ui text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: '#A39E94' }}>Bài kế tiếp</span>
                    <span className="font-ga-display text-[17px] font-medium text-ga-bg">{next.title}</span>
                  </div>
                ) : (
                  <div className="mb-3.5 font-ga-display text-[17px] font-medium text-ga-bg">🎉 Đã hoàn thành toàn bộ khóa học</div>
                )}
                <div className="mb-3.5 flex items-baseline gap-2.5">
                  <span className="font-ga-display text-[54px] font-medium leading-none">{progress}%</span>
                  <span className="text-[15px]" style={{ color: '#A39E94' }}>đã hoàn thành · {done.length}/{lessons.length} bài</span>
                </div>
                <div className="h-3 bg-white/15">
                  <div className="h-full transition-[width] duration-500" style={{ width: `${progress}%`, background: 'var(--ga-yellow)' }} />
                </div>
              </div>
              <div className="border-l border-white/15 pl-[30px]">
                {[
                  ['Buổi đã dạy', `${done.length}/${lessons.length}`],
                  ['Bài gần nhất hoàn thành', lastDone ? lastDone.title : '—'],
                  ['Hoàn thành lúc', lastDone?.completedAt ? format(new Date(lastDone.completedAt), 'dd/MM/yyyy') : '—'],
                ].map(([k, v], i) => (
                  <div key={k} className="py-[11px]" style={{ borderTop: i ? '1px solid rgba(255,255,255,0.12)' : 'none' }}>
                    <div className="ga-ui text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: '#A39E94' }}>{k}</div>
                    <div className="mt-1 truncate text-[14.5px] font-semibold text-ga-bg">{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lesson timeline (read-only) */}
            <GaCap className="mb-3.5 mt-7 block">Trình tự bài học</GaCap>
            <div className="border border-ga-line bg-ga-card">
              {ordered.map((l, i) => (
                <div key={l.id} className="flex items-center gap-3.5 px-5 py-3.5" style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px] font-bold"
                    style={{
                      background: l.completed ? 'var(--ga-green)' : 'transparent',
                      color: l.completed ? '#fff' : 'var(--ga-muted)',
                      borderColor: l.completed ? 'var(--ga-green)' : 'var(--ga-line)',
                    }}
                  >
                    {l.completed ? <Check size={14} /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold text-ga-ink">{l.title}</div>
                    {l.description && <div className="truncate text-[12px] text-ga-muted">{l.description}</div>}
                  </div>
                  {l.completed ? (
                    l.completedAt && <span className="shrink-0 text-[12px] font-medium" style={{ color: 'var(--ga-green)' }}>{format(new Date(l.completedAt), 'dd/MM')}</span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 text-[12px] text-ga-subtle"><Clock size={12} /> chưa dạy</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
