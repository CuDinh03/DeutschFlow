'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Check, Loader2, Info } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import { listLessons, createLesson, updateLesson, type ClassLesson } from '@/lib/teacherLessonsApi'
import { GaPageHdr, GaBtn, GaCap } from '@/components/ui-v2'
import { ClassPicker, useTeacherClasses, pct } from '../tcShared'

const VIOLET = '#7C56C8'

// ─────────────────────────────────────────────────────────────────────────────
// Checklist khóa học (GaTcChecklist) — violet, editable per-class lesson checklist.
// Plumbing reused 1:1 (zero backend): listLessons / createLesson / updateLesson
//   (`/v2/teacher/classes/{id}/lessons`). ClassLesson = flat {orderIndex,title,
//   description,completed,completedAt}. Option-1: proto's module grouping, milestones,
//   tri-state, per-lesson teacher notes, and per-lesson task lists have no backing →
//   dropped (flat list, 2-state completed). Marking done updates class progress + the
//   student's view (real — class_lessons V197).
// ─────────────────────────────────────────────────────────────────────────────

export default function V2TcChecklistPage() {
  const router = useRouter()
  const { classes, classId, setClassId, loadingClasses } = useTeacherClasses()
  const [lessons, setLessons] = useState<ClassLesson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)

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
  const progress = pct(lessons)

  const toggle = async (l: ClassLesson) => {
    if (!classId) return
    setBusy(l.id)
    try {
      const updated = await updateLesson(classId, l.id, { completed: !l.completed })
      setLessons((prev) => prev.map((x) => (x.id === l.id ? updated : x)))
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const add = async () => {
    const title = newTitle.trim()
    if (!title || !classId) return
    setCreating(true)
    try {
      await createLesson(classId, { title })
      setNewTitle('')
      toast.success('Đã thêm bài học')
      await load(classId)
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title="Checklist khóa học"
        subtitle="Đánh dấu hoàn thành theo buổi dạy — tiến độ lớp và góc nhìn học viên cập nhật theo thời gian thực"
        right={
          <div className="flex items-center gap-3">
            <ClassPicker classes={classes} classId={classId} onChange={setClassId} disabled={loadingClasses} />
            <span className="ga-ui hidden text-[13px] text-ga-muted sm:inline">
              Tiến độ: <strong className="font-ga-display text-[16px] text-ga-ink">{progress}%</strong>
            </span>
            <GaBtn variant="ghost" size="sm" onClick={() => router.push('/v2/teacher/tc-progress')}>Xem tổng quan</GaBtn>
          </div>
        }
      />

      <div className="flex-1 overflow-auto px-10 py-6">
        {/* Add lesson */}
        <div className="mb-5 flex border border-ga-line bg-ga-card">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Tên bài học mới (VD: Modalverben — können/müssen)"
            className="flex-1 bg-transparent px-5 py-[14px] text-[15px] text-ga-ink outline-none"
          />
          <button type="button" onClick={add} disabled={creating || !classId} className="flex shrink-0 items-center gap-2 bg-ga-ink px-[26px] text-[14px] font-semibold text-ga-bg disabled:opacity-60">
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={18} />} Thêm bài
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="ga-shimmer h-[58px] border border-ga-line" aria-hidden />)}</div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">Không tải được bài học</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">{error}</p>
            <GaBtn variant="primary" onClick={() => classId && load(classId)}>Thử lại</GaBtn>
          </div>
        ) : ordered.length === 0 ? (
          <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">
            Lớp chưa có bài học nào — thêm bài đầu tiên ở trên.
          </div>
        ) : (
          <div className="border border-ga-line bg-ga-card">
            {ordered.map((l, i) => (
              <div key={l.id} className="flex items-start gap-3.5 px-5 py-4" style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none', background: l.completed ? 'var(--ga-green-soft)' : undefined }}>
                <button
                  type="button"
                  aria-label={l.completed ? 'Bỏ đánh dấu hoàn thành' : 'Đánh dấu hoàn thành'}
                  onClick={() => toggle(l)}
                  disabled={busy === l.id}
                  className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors"
                  style={{ borderColor: l.completed ? 'var(--ga-green)' : 'var(--ga-line)', background: l.completed ? 'var(--ga-green)' : 'transparent' }}
                >
                  {busy === l.id ? <Loader2 size={12} className="animate-spin text-ga-muted" /> : l.completed ? <Check size={14} className="text-white" /> : null}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="ga-ui text-[10px] font-bold uppercase tracking-[0.08em] text-ga-subtle">Lektion {i + 1}</span>
                    {l.completed && l.completedAt && (
                      <span className="text-[11px] font-medium" style={{ color: 'var(--ga-green)' }}>✓ {format(new Date(l.completedAt), 'dd/MM/yyyy')}</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[14.5px] font-semibold text-ga-ink">{l.title}</div>
                  {l.description && <div className="mt-0.5 text-[12.5px] leading-[1.5] text-ga-muted">{l.description}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3 border px-[18px] py-3.5" style={{ background: 'var(--ga-violet-soft)', borderColor: 'color-mix(in srgb, var(--ga-violet) 25%, transparent)' }}>
          <Info size={18} style={{ color: VIOLET }} className="shrink-0" />
          <p className="ga-ui m-0 text-[13px] leading-[1.5] text-ga-ink">
            Mỗi lần đánh dấu một bài <strong>hoàn thành</strong>, phần trăm tiến độ lớp và góc nhìn của học viên sẽ tự cập nhật.
          </p>
        </div>
      </div>
    </div>
  )
}
