'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  ArrowLeft, ArrowDown, ArrowUp, CheckCircle2, Circle, Loader2,
  Pencil, Plus, Trash2, X,
} from 'lucide-react'
import { apiMessage } from '@/lib/api'
import {
  createLesson, deleteLesson, listLessons, reorderLessons, updateLesson,
  type ClassLesson,
} from '@/lib/teacherLessonsApi'

export default function TeacherLessonsClientPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const classId = Number(params?.id)

  const [lessons, setLessons] = useState<ClassLesson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | 'create' | null>(null)

  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const load = useCallback(async () => {
    if (!classId || Number.isNaN(classId)) return
    setError(null)
    try {
      setLessons(await listLessons(classId))
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [classId])

  useEffect(() => { void load() }, [load])

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    setBusyId('create')
    try {
      const created = await createLesson(classId, {
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
      })
      setLessons((cur) => [...cur, created])
      setNewTitle('')
      setNewDesc('')
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  const onToggle = async (lesson: ClassLesson) => {
    setBusyId(lesson.id)
    try {
      const updated = await updateLesson(classId, lesson.id, { completed: !lesson.completed })
      setLessons((cur) => cur.map((l) => l.id === updated.id ? updated : l))
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  const beginEdit = (lesson: ClassLesson) => {
    setEditingId(lesson.id)
    setEditTitle(lesson.title)
    setEditDesc(lesson.description ?? '')
  }

  const saveEdit = async (lesson: ClassLesson) => {
    if (!editTitle.trim()) return
    setBusyId(lesson.id)
    try {
      const updated = await updateLesson(classId, lesson.id, {
        title: editTitle.trim(),
        description: editDesc.trim(),
      })
      setLessons((cur) => cur.map((l) => l.id === updated.id ? updated : l))
      setEditingId(null)
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  const onDelete = async (lesson: ClassLesson) => {
    if (!confirm(`Xoá buổi học "${lesson.title}"?`)) return
    setBusyId(lesson.id)
    try {
      await deleteLesson(classId, lesson.id)
      setLessons((cur) => cur.filter((l) => l.id !== lesson.id))
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  const move = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= lessons.length) return
    const next = [...lessons]
    const [item] = next.splice(idx, 1)
    next.splice(target, 0, item)
    const optimisticIds = next.map((l) => l.id)
    setLessons(next)
    try {
      const persisted = await reorderLessons(classId, optimisticIds)
      setLessons(persisted)
    } catch (e) {
      setError(apiMessage(e))
      void load()
    }
  }

  const completedCount = lessons.filter((l) => l.completed).length

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/teacher/dashboard/${classId}`)}
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft size={14} /> Quay lại lớp
            </button>
          </div>
          <Link
            href="/teacher/dashboard"
            className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
          >
            Tất cả lớp
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        <section>
          <h1 className="text-2xl font-bold text-slate-800">Checklist buổi học</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tích vào các buổi đã dạy để cập nhật tiến độ lớp cho học viên.
            {lessons.length > 0 && (
              <span className="ml-1 font-semibold text-slate-700">
                ({completedCount}/{lessons.length} đã hoàn thành)
              </span>
            )}
          </p>
        </section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Đóng</button>
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">Thêm buổi học</h2>
          <form onSubmit={onCreate} className="space-y-3">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Tiêu đề buổi học (VD: Modalverben — Können / Müssen)"
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              disabled={busyId === 'create'}
              maxLength={500}
            />
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Mô tả ngắn (tuỳ chọn)"
              rows={2}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              disabled={busyId === 'create'}
            />
            <button
              type="submit"
              disabled={busyId === 'create' || !newTitle.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus size={14} />
              {busyId === 'create' ? 'Đang thêm…' : 'Thêm buổi'}
            </button>
          </form>
        </section>

        <section>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : lessons.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              Chưa có buổi học nào. Thêm buổi đầu tiên ở trên.
            </div>
          ) : (
            <ol className="space-y-2">
              {lessons.map((l, idx) => (
                <li
                  key={l.id}
                  className={`rounded-xl border p-4 transition ${
                    l.completed ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'
                  } ${busyId === l.id ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => onToggle(l)}
                      disabled={busyId === l.id}
                      className="mt-0.5"
                      aria-label={l.completed ? 'Bỏ tích' : 'Đánh dấu hoàn thành'}
                    >
                      {l.completed
                        ? <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                        : <Circle className="h-6 w-6 text-slate-300 hover:text-emerald-500" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      {editingId === l.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
                            autoFocus
                          />
                          <textarea
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            rows={2}
                            placeholder="Mô tả (tuỳ chọn)"
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => saveEdit(l)}
                              disabled={!editTitle.trim()}
                              className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                              Lưu
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              Huỷ
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 tabular-nums">
                              Buổi {idx + 1}
                            </span>
                            <h3 className="font-semibold text-slate-800">{l.title}</h3>
                          </div>
                          {l.description && (
                            <p className="mt-1 text-sm text-slate-500 whitespace-pre-wrap">{l.description}</p>
                          )}
                          {l.completed && l.completedAt && (
                            <p className="mt-1 text-xs text-emerald-700">
                              Đã tích {format(new Date(l.completedAt), 'dd/MM HH:mm')}
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => move(idx, -1)}
                        disabled={idx === 0 || busyId === l.id}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                        aria-label="Lên trên"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(idx, 1)}
                        disabled={idx === lessons.length - 1 || busyId === l.id}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                        aria-label="Xuống dưới"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>

                    {editingId !== l.id && (
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => beginEdit(l)}
                          disabled={busyId === l.id}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label="Sửa"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(l)}
                          disabled={busyId === l.id}
                          className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                          aria-label="Xoá"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </div>
  )
}
