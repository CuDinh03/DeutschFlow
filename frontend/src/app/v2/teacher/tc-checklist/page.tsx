'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Plus, Check, Loader2, Info, X, Pencil, Trash2, ArrowUp, ArrowDown, FolderPlus } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { listLessons, createLesson, updateLesson, deleteLesson, reorderLessons, type ClassLesson, type KnowledgePointInput, type CanDoStatementInput } from '@/lib/teacherLessonsApi'
import { listModules, createModule, updateModule, deleteModule, reorderModules, assignLessonModule, type CurriculumModule } from '@/lib/teacherModulesApi'
import { groupLessonsByModule, swapInOrder, type LessonModuleGroup } from '@/lib/moduleGrouping'
import { parseKnowledgePoints, resolvePointTexts } from '@/lib/knowledgePoints'
import { GaPageHdr, GaBtn } from '@/components/ui-v2'
import { ClassPicker, useTeacherClasses, pct } from '../tcShared'
import { parseIsoDateLocal } from '../lessonPacing'
import { LessonMaterialsPanel } from './LessonMaterialsPanel'
import { CanDoEditor, emptyCanDo, seedEditableCanDos, toCanDoPayload, type EditableCanDo } from './CanDoEditor'

/** Parse the estimated-units input to a positive integer, or undefined when empty/invalid. */
function parseUnits(raw: string): number | undefined {
  const n = Number(raw)
  return raw.trim() !== '' && Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined
}

const VIOLET = '#7C56C8'
const SKILL_TAG_OPTIONS = ['HOEREN', 'LESEN', 'SCHREIBEN', 'SPRECHEN'] as const
const CONTENT_TAG_OPTIONS = ['WORTSCHATZ', 'GRAMMATIK', 'AUSSPRACHE', 'LANDESKUNDE', 'REDEMITTEL', 'STRATEGIE'] as const

/** An editable knowledge point ('' tag = none). */
interface EditablePoint {
  text: string
  skillTag: string
  contentTag: string
}

const emptyPoint = (): EditablePoint => ({ text: '', skillTag: '', contentTag: '' })

/** Seed the editor from a lesson: structured points (Phase 1b) if present, else parsed description. */
function seedEditablePoints(lesson: ClassLesson): EditablePoint[] {
  const pts =
    lesson.knowledgePoints && lesson.knowledgePoints.length > 0
      ? lesson.knowledgePoints.map((p) => ({ text: p.text, skillTag: p.skillTag ?? '', contentTag: p.contentTag ?? '' }))
      : parseKnowledgePoints(lesson.description).map((t) => ({ text: t, skillTag: '', contentTag: '' }))
  return pts.length ? pts : [emptyPoint()]
}

/** Editor rows → API payload: drop empty-text rows, map '' tag → null. */
function toKnowledgePayload(points: EditablePoint[]): KnowledgePointInput[] {
  return points
    .map((p) => ({ text: p.text.trim(), skillTag: p.skillTag || null, contentTag: p.contentTag || null }))
    .filter((p) => p.text.length > 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// Nội dung giảng dạy (GaTcChecklist) — violet, editable per-class lesson list.
// (Nav label was corrected from "Lịch sử giảng dạy" → "Nội dung giảng dạy": this
//  screen AUTHORS content; the read-only progress dashboard lives at tc-progress.)
// Each lesson (Bài) carries a title + a list of "kiến thức cần học" (knowledge
// points). Phase 1b: points are authored as structured rows with optional skill /
// content tags and sent via `knowledgePoints`; the backend stores them in the
// lesson_knowledge_point table and mirrors them into description (dual-write for
// mobile/legacy). Marking a lesson done updates class progress + the student view.
// ─────────────────────────────────────────────────────────────────────────────

const labelCls = 'ga-ui mb-1.5 block text-[12px] font-bold uppercase tracking-[0.05em] text-ga-muted'
const fieldCls =
  'w-full rounded-ga border border-ga-line bg-ga-bg px-3 py-2 text-[13.5px] text-ga-ink outline-none focus:border-ga-accent'

/** Dynamic editor for a lesson's knowledge points — text + optional skill/content tag per row. */
function KnowledgePointsEditor({
  points,
  onChange,
  placeholder,
  addLabel,
  removeLabel,
  itemLabel,
}: {
  points: EditablePoint[]
  onChange: (next: EditablePoint[]) => void
  placeholder: string
  addLabel: string
  removeLabel: string
  itemLabel: (index: number) => string
}) {
  const t = useTranslations('v2.teacher.tcChecklist')
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

  const setAt = (i: number, patch: Partial<EditablePoint>) =>
    onChange(points.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
  const removeAt = (i: number) => {
    if (points.length <= 1) {
      pendingFocus.current = 0
      onChange([emptyPoint()])
      return
    }
    pendingFocus.current = Math.max(0, i - 1)
    onChange(points.filter((_, idx) => idx !== i))
  }
  const addRow = () => {
    pendingFocus.current = points.length
    onChange([...points, emptyPoint()])
  }

  const tagSelectCls = `${fieldCls} w-auto py-1.5 text-[12px]`

  return (
    <div className="flex flex-col gap-2.5">
      {points.map((p, i) => (
        <div key={i} className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 sm:flex-1">
            <span className="w-4 shrink-0 text-right text-[12.5px] text-ga-subtle" aria-hidden>{i + 1}.</span>
            <input
              ref={(el) => {
                inputs.current[i] = el
              }}
              value={p.text}
              aria-label={itemLabel(i)}
              onChange={(e) => setAt(i, { text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addRow()
                }
              }}
              placeholder={placeholder}
              className={`flex-1 ${fieldCls}`}
            />
          </div>
          <div className="flex items-center gap-2 pl-6 sm:shrink-0 sm:pl-0">
            <select aria-label={t('skillTagLabel')} value={p.skillTag} onChange={(e) => setAt(i, { skillTag: e.target.value })} className={tagSelectCls}>
              <option value="">{t('skillTagLabel')}: {t('tagNone')}</option>
              {SKILL_TAG_OPTIONS.map((o) => (
                <option key={o} value={o}>{t(`skillTags.${o}`)}</option>
              ))}
            </select>
            <select aria-label={t('contentTagLabel')} value={p.contentTag} onChange={(e) => setAt(i, { contentTag: e.target.value })} className={tagSelectCls}>
              <option value="">{t('contentTagLabel')}: {t('tagNone')}</option>
              {CONTENT_TAG_OPTIONS.map((o) => (
                <option key={o} value={o}>{t(`contentTags.${o}`)}</option>
              ))}
            </select>
            <button
              type="button"
              aria-label={removeLabel}
              onClick={() => removeAt(i)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-ga text-ga-subtle transition-colors hover:bg-ga-red-soft hover:text-ga-red"
            >
              <X size={15} />
            </button>
          </div>
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

const CEFR_OPTIONS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

/** CEFR level + planned date + estimated units — shared by the add and edit forms. */
function LessonMetaFields({
  cefr,
  planned,
  units,
  onCefr,
  onPlanned,
  onUnits,
}: {
  cefr: string
  planned: string
  units: string
  onCefr: (v: string) => void
  onPlanned: (v: string) => void
  onUnits: (v: string) => void
}) {
  const t = useTranslations('v2.teacher.tcChecklist')
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div>
        <label className={labelCls}>{t('cefrLabel')}</label>
        <select aria-label={t('cefrLabel')} value={cefr} onChange={(e) => onCefr(e.target.value)} className={fieldCls}>
          <option value="">{t('cefrNone')}</option>
          {CEFR_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>{t('plannedDateLabel')}</label>
        <input type="date" aria-label={t('plannedDateLabel')} value={planned} onChange={(e) => onPlanned(e.target.value)} className={fieldCls} />
      </div>
      <div>
        <label className={labelCls}>{t('estimatedUnitsLabel')}</label>
        <input
          type="number"
          min={1}
          step={1}
          aria-label={t('estimatedUnitsLabel')}
          value={units}
          onChange={(e) => onUnits(e.target.value)}
          placeholder={t('estimatedUnitsPlaceholder')}
          className={fieldCls}
        />
      </div>
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
  const [newPoints, setNewPoints] = useState<EditablePoint[]>([emptyPoint()])
  const [newCanDos, setNewCanDos] = useState<EditableCanDo[]>([emptyCanDo()])
  const [newCefr, setNewCefr] = useState('')
  const [newPlanned, setNewPlanned] = useState('')
  const [newUnits, setNewUnits] = useState('')
  const [creating, setCreating] = useState(false)

  // Inline edit
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editPoints, setEditPoints] = useState<EditablePoint[]>([emptyPoint()])
  const [editCanDos, setEditCanDos] = useState<EditableCanDo[]>([emptyCanDo()])
  const [editCefr, setEditCefr] = useState('')
  const [editPlanned, setEditPlanned] = useState('')
  const [editUnits, setEditUnits] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [reordering, setReordering] = useState(false)

  // Modules (Phase 1c)
  const [modules, setModules] = useState<CurriculumModule[]>([])
  const [newModuleTitle, setNewModuleTitle] = useState('')
  const [creatingModule, setCreatingModule] = useState(false)
  const [editingModuleId, setEditingModuleId] = useState<number | null>(null)
  const [editModuleTitle, setEditModuleTitle] = useState('')
  const [moduleBusy, setModuleBusy] = useState(false)

  const load = useCallback(async (cid: number) => {
    setLoading(true)
    try {
      const [ls, ms] = await Promise.all([listLessons(cid), listModules(cid).catch(() => [])])
      setLessons(ls)
      setModules(ms)
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (classId) void load(classId) }, [classId, load])

  const ordered = useMemo(() => [...lessons].sort((a, b) => a.orderIndex - b.orderIndex), [lessons])
  const orderedModules = useMemo(() => [...modules].sort((a, b) => a.orderIndex - b.orderIndex), [modules])
  // Groups for the lesson list (empty modules hidden here; the module manager lists all).
  const lessonGroups = useMemo(
    () => groupLessonsByModule(ordered, orderedModules).filter((g) => g.lessons.length > 0),
    [ordered, orderedModules],
  )
  // "Lektion N" badge = position in the grouped reading order (top-to-bottom), so numbers stay
  // contiguous 1..n even when a module's lessons are non-contiguous in flat orderIndex.
  const seqById = useMemo(() => {
    const m = new Map<number, number>()
    let n = 0
    for (const g of lessonGroups) for (const l of g.lessons) m.set(l.id, ++n)
    return m
  }, [lessonGroups])
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

  // Group-relative reorder: the list renders grouped by module, so the up/down arrows must move a
  // lesson relative to its *module* neighbours, not its flat orderIndex neighbours (which may live
  // in another module). We swap the lesson with its group-adjacent sibling by their positions in
  // the flat `ordered` list, then write the array position back into `orderIndex` so the next
  // render's orderIndex-sort keeps the new order (otherwise it would snap back).
  const moveWithinGroup = async (group: LessonModuleGroup<ClassLesson>, gi: number, direction: -1 | 1) => {
    if (!classId || reordering) return
    const targetGi = gi + direction
    if (targetGi < 0 || targetGi >= group.lessons.length) return
    const next = swapInOrder(ordered, group.lessons[gi].id, group.lessons[targetGi].id)
    if (!next) return
    setLessons(next.map((l, idx) => ({ ...l, orderIndex: idx })))
    setReordering(true)
    try {
      const persisted = await reorderLessons(classId, next.map((l) => l.id))
      setLessons(persisted)
    } catch (e: unknown) {
      toast.error(apiMessage(e))
      await load(classId)
    } finally {
      setReordering(false)
    }
  }

  // ── Module handlers ─────────────────────────────────────────────────────
  const addModule = async () => {
    const title = newModuleTitle.trim()
    if (!title || !classId) return
    setCreatingModule(true)
    try {
      const created = await createModule(classId, title)
      setModules((prev) => [...prev, created])
      setNewModuleTitle('')
      toast.success(t('module.addSuccess'))
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setCreatingModule(false)
    }
  }

  const startEditModule = (m: CurriculumModule) => {
    setEditingModuleId(m.id)
    setEditModuleTitle(m.title)
  }
  const cancelEditModule = () => {
    setEditingModuleId(null)
    setEditModuleTitle('')
  }
  const saveModule = async (m: CurriculumModule) => {
    const title = editModuleTitle.trim()
    if (!title || !classId) return
    setModuleBusy(true)
    try {
      const updated = await updateModule(classId, m.id, title)
      setModules((prev) => prev.map((x) => (x.id === m.id ? updated : x)))
      cancelEditModule()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setModuleBusy(false)
    }
  }
  const removeModule = async (m: CurriculumModule) => {
    if (!classId) return
    if (typeof window !== 'undefined' && !window.confirm(t('module.deleteConfirm'))) return
    setModuleBusy(true)
    try {
      await deleteModule(classId, m.id)
      // Deleting a module ungroups its lessons (FK SET NULL) → reload both.
      await load(classId)
      toast.success(t('module.deleteSuccess'))
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setModuleBusy(false)
    }
  }
  const moveModule = async (index: number, direction: -1 | 1) => {
    if (!classId || moduleBusy) return
    const target = index + direction
    if (target < 0 || target >= orderedModules.length) return
    const next = [...orderedModules]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    setModules(next.map((m, idx) => ({ ...m, orderIndex: idx })))
    setModuleBusy(true)
    try {
      const persisted = await reorderModules(classId, next.map((m) => m.id))
      setModules(persisted)
    } catch (e: unknown) {
      toast.error(apiMessage(e))
      await load(classId)
    } finally {
      setModuleBusy(false)
    }
  }
  const assignModule = async (lesson: ClassLesson, moduleId: number | null) => {
    if (!classId) return
    try {
      const updated = await assignLessonModule(classId, lesson.id, moduleId)
      setLessons((prev) => prev.map((x) => (x.id === lesson.id ? updated : x)))
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    }
  }

  const add = async () => {
    const title = newTitle.trim()
    if (!title || !classId) return
    setCreating(true)
    try {
      await createLesson(classId, {
        title,
        knowledgePoints: toKnowledgePayload(newPoints),
        canDoStatements: toCanDoPayload(newCanDos),
        cefrLevel: newCefr || undefined,
        plannedDate: newPlanned || undefined,
        estimatedUnits: parseUnits(newUnits),
      })
      setNewTitle('')
      setNewPoints([emptyPoint()])
      setNewCanDos([emptyCanDo()])
      setNewCefr('')
      setNewPlanned('')
      setNewUnits('')
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
    setEditPoints(seedEditablePoints(l))
    setEditCanDos(seedEditableCanDos(l.canDoStatements))
    setEditCefr(l.cefrLevel ?? '')
    setEditPlanned(l.plannedDate ?? '')
    setEditUnits(l.estimatedUnits != null ? String(l.estimatedUnits) : '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
    setEditPoints([emptyPoint()])
    setEditCanDos([emptyCanDo()])
    setEditCefr('')
    setEditPlanned('')
    setEditUnits('')
  }

  const saveEdit = async (l: ClassLesson) => {
    if (!classId) return
    const title = editTitle.trim()
    if (!title) return
    setSavingEdit(true)
    try {
      // Only send knowledgePoints when they actually changed vs the seeded original — a
      // title-only edit omits them so the PATCH leaves the stored points untouched
      // (avoids needless sub-table churn + a lossy re-serialize of legacy free-text).
      const nextPoints = toKnowledgePayload(editPoints)
      const pointsChanged = JSON.stringify(nextPoints) !== JSON.stringify(toKnowledgePayload(seedEditablePoints(l)))
      // Same "only send when changed" guard for can-dos (Phase 1e) — a metadata-only edit
      // must not wipe or re-serialize the stored statements.
      const nextCanDos = toCanDoPayload(editCanDos)
      const canDosChanged = JSON.stringify(nextCanDos) !== JSON.stringify(toCanDoPayload(seedEditableCanDos(l.canDoStatements)))
      const body: {
        title: string
        knowledgePoints?: KnowledgePointInput[]
        canDoStatements?: CanDoStatementInput[]
        cefrLevel?: string
        plannedDate?: string
        estimatedUnits?: number
        clearCefrLevel?: boolean
        clearPlannedDate?: boolean
        clearEstimatedUnits?: boolean
      } = { title }
      if (pointsChanged) body.knowledgePoints = nextPoints
      if (canDosChanged) body.canDoStatements = nextCanDos
      // A set value is sent; emptying a previously-set field sends an explicit clear flag
      // (a bare omission would leave the stored value untouched under PATCH semantics).
      if (editCefr) body.cefrLevel = editCefr
      else if (l.cefrLevel) body.clearCefrLevel = true
      if (editPlanned) body.plannedDate = editPlanned
      else if (l.plannedDate) body.clearPlannedDate = true
      const units = parseUnits(editUnits)
      if (units !== undefined) body.estimatedUnits = units
      else if (!editUnits.trim() && l.estimatedUnits != null) body.clearEstimatedUnits = true

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

          <div className="mt-4">
            <label className={labelCls}>{t('canDo.heading')}</label>
            <CanDoEditor value={newCanDos} onChange={setNewCanDos} />
          </div>

          <div className="mt-4">
            <LessonMetaFields
              cefr={newCefr}
              planned={newPlanned}
              units={newUnits}
              onCefr={setNewCefr}
              onPlanned={setNewPlanned}
              onUnits={setNewUnits}
            />
          </div>
        </div>

        {/* Module manager (Phase 1c) */}
        {!error && (
          <div className="mb-5 border border-ga-line bg-ga-card p-4">
            <label className={labelCls}>{t('module.heading')}</label>
            <div className="flex gap-2">
              <input
                value={newModuleTitle}
                onChange={(e) => setNewModuleTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addModule() } }}
                placeholder={t('module.addPlaceholder')}
                className={`flex-1 ${fieldCls}`}
              />
              <button
                type="button"
                onClick={addModule}
                disabled={creatingModule || !classId || !newModuleTitle.trim()}
                className="flex shrink-0 items-center gap-2 rounded-ga bg-ga-ink px-[18px] text-[14px] font-semibold text-ga-bg disabled:opacity-60"
              >
                {creatingModule ? <Loader2 size={16} className="animate-spin" /> : <FolderPlus size={16} />} {t('module.add')}
              </button>
            </div>
            {orderedModules.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-1.5">
                {orderedModules.map((m, i) => (
                  <li key={m.id} className="flex items-center gap-2 rounded-ga border border-ga-line bg-ga-bg px-2.5 py-1.5">
                    {editingModuleId === m.id ? (
                      <>
                        <input
                          value={editModuleTitle}
                          onChange={(e) => setEditModuleTitle(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void saveModule(m) } }}
                          className={`flex-1 ${fieldCls}`}
                          autoFocus
                        />
                        <GaBtn variant="primary" size="sm" onClick={() => saveModule(m)} disabled={moduleBusy || !editModuleTitle.trim()}>{t('save')}</GaBtn>
                        <GaBtn variant="ghost" size="sm" onClick={cancelEditModule} disabled={moduleBusy}>{t('cancel')}</GaBtn>
                      </>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ga-ink">{m.title}</span>
                        <button type="button" aria-label={t('module.moveUp')} onClick={() => moveModule(i, -1)} disabled={i === 0 || moduleBusy} className="grid h-7 w-7 place-items-center rounded-ga text-ga-subtle transition-colors hover:bg-ga-side-active hover:text-ga-ink disabled:pointer-events-none disabled:opacity-30"><ArrowUp size={13} /></button>
                        <button type="button" aria-label={t('module.moveDown')} onClick={() => moveModule(i, 1)} disabled={i === orderedModules.length - 1 || moduleBusy} className="grid h-7 w-7 place-items-center rounded-ga text-ga-subtle transition-colors hover:bg-ga-side-active hover:text-ga-ink disabled:pointer-events-none disabled:opacity-30"><ArrowDown size={13} /></button>
                        <button type="button" aria-label={t('module.rename')} onClick={() => startEditModule(m)} className="grid h-7 w-7 place-items-center rounded-ga text-ga-subtle transition-colors hover:bg-ga-side-active hover:text-ga-ink"><Pencil size={14} /></button>
                        <button type="button" aria-label={t('module.delete')} onClick={() => removeModule(m)} disabled={moduleBusy} className="grid h-7 w-7 place-items-center rounded-ga text-ga-subtle transition-colors hover:bg-ga-red-soft hover:text-ga-red disabled:pointer-events-none disabled:opacity-40"><Trash2 size={14} /></button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[12.5px] text-ga-subtle">{t('module.empty')}</p>
            )}
          </div>
        )}

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
          <div className="flex flex-col gap-4">
            {lessonGroups.map((group) => (
              <div key={group.module?.id ?? 'ungrouped'} className="border border-ga-line bg-ga-card">
                <div className="border-b border-ga-line px-4 py-2 text-[12px] font-bold uppercase tracking-[0.06em]" style={{ color: VIOLET, background: 'var(--ga-violet-soft)' }}>
                  {group.module ? group.module.title : t('ungrouped')}
                </div>
                {group.lessons.map((l, gi) => {
                  const points = resolvePointTexts(l.knowledgePoints, l.description)
                  const isEditing = editingId === l.id
                  return (
                    <div key={l.id} style={{ borderTop: gi ? '1px solid var(--ga-line)' : 'none', background: !isEditing && l.completed ? 'var(--ga-green-soft)' : undefined }}>
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
                      <div>
                        <label className={labelCls}>{t('canDo.heading')}</label>
                        <CanDoEditor value={editCanDos} onChange={setEditCanDos} />
                      </div>
                      <LessonMetaFields
                        cefr={editCefr}
                        planned={editPlanned}
                        units={editUnits}
                        onCefr={setEditCefr}
                        onPlanned={setEditPlanned}
                        onUnits={setEditUnits}
                      />
                      <LessonMaterialsPanel lessonId={l.id} />
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
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="ga-ui text-[10px] font-bold uppercase tracking-[0.08em] text-ga-subtle">{t('lektion', { index: seqById.get(l.id) ?? 0 })}</span>
                          {l.cefrLevel && (
                            <span className="ga-ui rounded-ga px-1.5 text-[10px] font-bold" style={{ background: 'var(--ga-violet-soft)', color: VIOLET }}>{l.cefrLevel}</span>
                          )}
                          {points.length > 0 && (
                            <span className="ga-ui text-[10px] font-semibold text-ga-subtle">· {t('knowledgeCount', { count: points.length })}</span>
                          )}
                          {l.plannedDate && (
                            <span className="ga-ui text-[10px] font-medium text-ga-subtle">· {t('plannedShort', { date: format(parseIsoDateLocal(l.plannedDate), 'dd/MM') })}</span>
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
                        {l.canDoStatements && l.canDoStatements.length > 0 && (
                          <div className="mt-1.5">
                            <span className="ga-ui text-[10px] font-bold uppercase tracking-[0.06em] text-ga-subtle">{t('canDo.heading')}</span>
                            <ul className="mt-1 flex flex-col gap-1">
                              {l.canDoStatements.map((c) => (
                                <li key={c.id ?? c.orderIndex} className="flex gap-2 text-[12.5px] leading-[1.5] text-ga-muted">
                                  <span className="mt-[1px] shrink-0" style={{ color: VIOLET }}>✓</span>
                                  <span className="min-w-0 break-words">
                                    {c.text}
                                    {c.cefrLevel && (
                                      <span className="ga-ui ml-1.5 rounded-ga px-1 text-[9px] font-bold" style={{ background: 'var(--ga-violet-soft)', color: VIOLET }}>{c.cefrLevel}</span>
                                    )}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {orderedModules.length > 0 && (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className="ga-ui text-[10px] font-semibold uppercase tracking-[0.06em] text-ga-subtle">{t('module.assignLabel')}</span>
                            <select
                              aria-label={t('module.assignLabel')}
                              value={l.moduleId ?? ''}
                              onChange={(e) => assignModule(l, e.target.value ? Number(e.target.value) : null)}
                              className="rounded-ga border border-ga-line bg-ga-bg px-1.5 py-0.5 text-[11px] text-ga-ink outline-none focus:border-ga-accent"
                            >
                              <option value="">{t('ungrouped')}</option>
                              {orderedModules.map((m) => (
                                <option key={m.id} value={m.id}>{m.title}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col gap-0.5">
                        <button
                          type="button"
                          aria-label={t('moveUp')}
                          onClick={() => moveWithinGroup(group, gi, -1)}
                          disabled={gi === 0 || reordering || busy === l.id || deletingId === l.id}
                          className="grid h-6 w-6 place-items-center rounded-ga text-ga-subtle transition-colors hover:bg-ga-side-active hover:text-ga-ink disabled:pointer-events-none disabled:opacity-30"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          aria-label={t('moveDown')}
                          onClick={() => moveWithinGroup(group, gi, 1)}
                          disabled={gi === group.lessons.length - 1 || reordering || busy === l.id || deletingId === l.id}
                          className="grid h-6 w-6 place-items-center rounded-ga text-ga-subtle transition-colors hover:bg-ga-side-active hover:text-ga-ink disabled:pointer-events-none disabled:opacity-30"
                        >
                          <ArrowDown size={13} />
                        </button>
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
            ))}
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
