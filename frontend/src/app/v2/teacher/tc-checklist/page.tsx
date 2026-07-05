'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Plus, Check, Loader2, Info, X, Pencil, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { listLessons, createLesson, updateLesson, deleteLesson, type ClassLesson } from '@/lib/teacherLessonsApi'
import { parseKnowledgePoints, formatKnowledgePoints } from '@/lib/knowledgePoints'
import { GaPageHdr, GaBtn } from '@/components/ui-v2'
import { ClassPicker, useTeacherClasses, pct } from '../tcShared'

const VIOLET = '#7C56C8'

// ─────────────────────────────────────────────────────────────────────────────
// Lịch sử giảng dạy (GaTcChecklist) — violet, editable per-class lesson list.
// Each lesson (Bài) carries a title + a list of "kiến thức cần học" (knowledge
// points). Points are stored newline-separated in ClassLesson.description via
// parse/formatKnowledgePoints (tcShared) — no schema change, zero backend. The
// teacher can add / edit / delete lessons and their points; marking a lesson done
// updates class progress + the student's view (class_lessons V197, real).
// ─────────────────────────────────────────────────────────────────────────────

const labelCls = 'ga-ui mb-1.5 block text-[12px] font-bold uppercase tracking-[0.05em] text-ga-muted'
const fieldCls =
  'w-full rounded-ga border border-ga-line bg-ga-bg px-3 py-2 text-[13.5px] text-ga-ink outline-none focus:border-ga-accent'

/** Dynamic editor for a lesson's knowledge points (one input per point). */
function KnowledgePointsEditor({
  points,
  onChange,
  placeholder,
  addLabel,
  removeLabel,
  itemLabel,
}: {
  points: string[]
  onChange: (next: string[]) => void
  placeholder: string
  addLabel: string
  removeLabel: string
  itemLabel: (index: number) => string
}) {
  const inputs = useRef<Array<HTMLInputElement | null>>([])
  // Index to focus after the next render — keeps keyboard/SR users oriented when a
  // row is added (Enter or +) or removed. null = no pending focus move.
  const pendingFocus = useRef<number | null>(null)

  useEffect(() => {
    if (pendingFocus.current !== null) {
      inputs.current[pendingFocus.current]?.focus()
      pendingFocus.current = null
    }
  })

  const setAt = (i: number, v: string) => onChange(points.map((p, idx) => (idx === i ? v : p)))
  const removeAt = (i: number) => {
    if (points.length <= 1) {
      pendingFocus.current = 0
      onChange([''])
      return
    }
    pendingFocus.current = Math.max(0, i - 1)
    onChange(points.filter((_, idx) => idx !== i))
  }
  const addRow = () => {
    pendingFocus.current = points.length
    onChange([...points, ''])
  }

  return (
    <div className="flex flex-col gap-2">
      {points.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-4 shrink-0 text-right text-[12.5px] text-ga-subtle" aria-hidden>{i + 1}.</span>
          <input
            ref={(el) => {
              inputs.current[i] = el
            }}
            value={p}
            aria-label={itemLabel(i)}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addRow()
              }
            }}
            placeholder={placeholder}
            className={`flex-1 ${fieldCls}`}
          />
          <button
            type="button"
            aria-label={removeLabel}
            onClick={() => removeAt(i)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-ga text-ga-subtle transition-colors hover:bg-ga-red-soft hover:text-ga-red"
          >
            <X size={15} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 self-start text-[13px] font-semibold"
        style={{ color: VIOLET }}
      >
        <Plus size={14} /> {addLabel}
      </button>
    </div>
  )
}

export default function V2TcChecklistPage() {
  const t = useTranslations('v2.teacher.tcChecklist')
  const tc = useTranslations('v2.common')
  const router = useRouter()
  const { classes, classId, setClassId, loadingClasses } = useTeacherClasses()
  const [lessons, setLessons] = useState<ClassLesson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<number | null>(null)

  // Add form
  const [newTitle, setNewTitle] = useState('')
  const [newPoints, setNewPoints] = useState<string[]>([''])
  const [creating, setCreating] = useState(false)

  // Inline edit
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editPoints, setEditPoints] = useState<string[]>([''])
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

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
      await createLesson(classId, { title, description: formatKnowledgePoints(newPoints) || undefined })
      setNewTitle('')
      setNewPoints([''])
      toast.success(t('addLessonSuccess'))
      await load(classId)
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (l: ClassLesson) => {
    setEditingId(l.id)
    setEditTitle(l.title)
    const pts = parseKnowledgePoints(l.description)
    setEditPoints(pts.length ? pts : [''])
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
    setEditPoints([''])
  }

  const saveEdit = async (l: ClassLesson) => {
    if (!classId) return
    const title = editTitle.trim()
    if (!title) return
    setSavingEdit(true)
    try {
      // Only touch `description` when the points actually changed. A title-only edit
      // omits the field so the PATCH leaves the stored description byte-for-byte intact
      // (avoids re-serializing legacy free-text through the lossy parse/format round-trip).
      const original = parseKnowledgePoints(l.description)
      const next = editPoints.map((p) => p.trim()).filter((p) => p.length > 0)
      const pointsChanged = next.length !== original.length || next.some((p, i) => p !== original[i])
      const body: { title: string; description?: string } = { title }
      if (pointsChanged) body.description = formatKnowledgePoints(editPoints)

      const updated = await updateLesson(classId, l.id, body)
      setLessons((prev) => prev.map((x) => (x.id === l.id ? updated : x)))
      toast.success(t('updateSuccess'))
      cancelEdit()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSavingEdit(false)
    }
  }

  const removeLesson = async (l: ClassLesson) => {
    if (!classId) return
    if (typeof window !== 'undefined' && !window.confirm(t('deleteConfirm'))) return
    setDeletingId(l.id)
    try {
      await deleteLesson(classId, l.id)
      setLessons((prev) => prev.filter((x) => x.id !== l.id))
      if (editingId === l.id) cancelEdit()
      toast.success(t('deleteSuccess'))
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <div className="flex items-center gap-3">
            <ClassPicker classes={classes} classId={classId} onChange={setClassId} disabled={loadingClasses} />
            <span className="ga-ui hidden text-[13px] text-ga-muted sm:inline">
              {t('progress')}: <strong className="font-ga-display text-[16px] text-ga-ink">{progress}%</strong>
            </span>
            <GaBtn variant="ghost" size="sm" onClick={() => router.push('/v2/teacher/tc-progress')}>{t('viewOverview')}</GaBtn>
          </div>
        }
      />

      <div className="flex-1 overflow-auto px-10 py-6">
        {/* Add lesson: title + knowledge points */}
        <div className="mb-5 border border-ga-line bg-ga-card p-4">
          <label className={labelCls}>{t('lessonTitleLabel')}</label>
          <div className="flex gap-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t('newLessonPlaceholder')}
              className={`flex-1 ${fieldCls} text-[15px]`}
            />
            <button
              type="button"
              onClick={add}
              disabled={creating || !classId || !newTitle.trim()}
              className="flex shrink-0 items-center gap-2 rounded-ga bg-ga-ink px-[22px] text-[14px] font-semibold text-ga-bg disabled:opacity-60"
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={18} />} {t('addLesson')}
            </button>
          </div>

          <div className="mt-4">
            <label className={labelCls}>{t('knowledgeHeading')}</label>
            <KnowledgePointsEditor
              points={newPoints}
              onChange={setNewPoints}
              placeholder={t('knowledgePlaceholder')}
              addLabel={t('addKnowledge')}
              removeLabel={t('removeKnowledge')}
              itemLabel={(i) => t('knowledgeItemLabel', { index: i + 1 })}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="ga-shimmer h-[58px] border border-ga-line" aria-hidden />)}</div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">{t('loadError')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">{error}</p>
            <GaBtn variant="primary" onClick={() => classId && load(classId)}>{tc('retry')}</GaBtn>
          </div>
        ) : ordered.length === 0 ? (
          <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">
            {t('empty')}
          </div>
        ) : (
          <div className="border border-ga-line bg-ga-card">
            {ordered.map((l, i) => {
              const points = parseKnowledgePoints(l.description)
              const isEditing = editingId === l.id
              return (
                <div key={l.id} style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none', background: !isEditing && l.completed ? 'var(--ga-green-soft)' : undefined }}>
                  {isEditing ? (
                    <div className="flex flex-col gap-3 px-5 py-4">
                      <div>
                        <label className={labelCls}>{t('lessonTitleLabel')}</label>
                        <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={`${fieldCls} text-[15px]`} />
                      </div>
                      <div>
                        <label className={labelCls}>{t('knowledgeHeading')}</label>
                        <KnowledgePointsEditor
                          points={editPoints}
                          onChange={setEditPoints}
                          placeholder={t('knowledgePlaceholder')}
                          addLabel={t('addKnowledge')}
                          removeLabel={t('removeKnowledge')}
                          itemLabel={(i) => t('knowledgeItemLabel', { index: i + 1 })}
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <GaBtn variant="ghost" size="sm" onClick={cancelEdit} disabled={savingEdit}>{t('cancel')}</GaBtn>
                        <GaBtn variant="primary" size="sm" onClick={() => saveEdit(l)} disabled={savingEdit || !editTitle.trim()}>
                          {savingEdit ? <Loader2 size={14} className="animate-spin" /> : t('save')}
                        </GaBtn>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3.5 px-5 py-4">
                      <button
                        type="button"
                        aria-label={l.completed ? t('markIncomplete') : t('markComplete')}
                        onClick={() => toggle(l)}
                        disabled={busy === l.id}
                        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors"
                        style={{ borderColor: l.completed ? 'var(--ga-green)' : 'var(--ga-line)', background: l.completed ? 'var(--ga-green)' : 'transparent' }}
                      >
                        {busy === l.id ? <Loader2 size={12} className="animate-spin text-ga-muted" /> : l.completed ? <Check size={14} className="text-white" /> : null}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="ga-ui text-[10px] font-bold uppercase tracking-[0.08em] text-ga-subtle">{t('lektion', { index: i + 1 })}</span>
                          {points.length > 0 && (
                            <span className="ga-ui text-[10px] font-semibold text-ga-subtle">· {t('knowledgeCount', { count: points.length })}</span>
                          )}
                          {l.completed && l.completedAt && (
                            <span className="text-[11px] font-medium" style={{ color: 'var(--ga-green)' }}>✓ {format(new Date(l.completedAt), 'dd/MM/yyyy')}</span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[14.5px] font-semibold text-ga-ink">{l.title}</div>
                        {points.length > 0 && (
                          <ul className="mt-1.5 flex flex-col gap-1">
                            {points.map((p, idx) => (
                              <li key={idx} className="flex gap-2 text-[12.5px] leading-[1.5] text-ga-muted">
                                <span className="mt-[1px] shrink-0" style={{ color: VIOLET }}>•</span>
                                <span className="min-w-0 break-words">{p}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          aria-label={t('edit')}
                          onClick={() => startEdit(l)}
                          className="grid h-8 w-8 place-items-center rounded-ga text-ga-subtle transition-colors hover:bg-ga-side-active hover:text-ga-ink"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          aria-label={t('deleteLesson')}
                          onClick={() => removeLesson(l)}
                          disabled={deletingId === l.id}
                          className="grid h-8 w-8 place-items-center rounded-ga text-ga-subtle transition-colors hover:bg-ga-red-soft hover:text-ga-red"
                        >
                          {deletingId === l.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={15} />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3 border px-[18px] py-3.5" style={{ background: 'var(--ga-violet-soft)', borderColor: 'color-mix(in srgb, var(--ga-violet) 25%, transparent)' }}>
          <Info size={18} style={{ color: VIOLET }} className="shrink-0" />
          <p className="ga-ui m-0 text-[13px] leading-[1.5] text-ga-ink">
            {t.rich('infoNote', { b: (chunks) => <strong>{chunks}</strong> })}
          </p>
        </div>
      </div>
    </div>
  )
}
