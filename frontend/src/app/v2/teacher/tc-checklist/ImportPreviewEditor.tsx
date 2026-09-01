'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import type {
  DraftCanDoStatement,
  DraftKnowledgePoint,
  DraftLesson,
  DraftModule,
} from '@/lib/curriculumImportApi'

const SKILL_TAG_OPTIONS = ['HOEREN', 'LESEN', 'SCHREIBEN', 'SPRECHEN'] as const
const CONTENT_TAG_OPTIONS = [
  'WORTSCHATZ',
  'GRAMMATIK',
  'AUSSPRACHE',
  'LANDESKUNDE',
  'REDEMITTEL',
  'STRATEGIE',
] as const

const fieldBase =
  'rounded-ga border border-ga-line bg-ga-bg px-2.5 py-1.5 text-[13px] text-ga-ink outline-none focus:border-ga-accent'
const fieldCls = `w-full ${fieldBase}`
// Own base class, not `${fieldCls} w-auto`: fieldCls already sets w-full and the two collide, which
// is what made every tag select claim a full row of its own.
const tagSelectCls = `${fieldBase} w-full py-1 text-[11.5px] sm:w-[124px]`

/**
 * Which modules and lessons the teacher wants to keep. Held by clientId rather than array index so
 * a selection survives edits that reorder or remove rows.
 */
export interface DraftSelection {
  modules: Record<string, boolean>
  lessons: Record<string, boolean>
}

export function allSelected(modules: DraftModule[]): DraftSelection {
  const sel: DraftSelection = { modules: {}, lessons: {} }
  for (const m of modules) {
    sel.modules[m.clientId] = true
    for (const l of m.lessons) sel.lessons[l.clientId] = true
  }
  return sel
}

/**
 * The draft reduced to what will actually be written: unticked modules and lessons drop out, and a
 * module whose every lesson was unticked drops with them (an empty module is not a curriculum).
 */
export function applySelection(modules: DraftModule[], sel: DraftSelection): DraftModule[] {
  return modules
    .filter((m) => sel.modules[m.clientId] !== false)
    .map((m) => ({ ...m, lessons: m.lessons.filter((l) => sel.lessons[l.clientId] !== false) }))
    .filter((m) => m.lessons.length > 0)
}

/** Editable review of one import draft. Nothing here talks to the server. */
export function ImportPreviewEditor({
  modules,
  selection,
  onChange,
  onSelectionChange,
  disabled,
}: {
  modules: DraftModule[]
  selection: DraftSelection
  onChange: (next: DraftModule[]) => void
  onSelectionChange: (next: DraftSelection) => void
  disabled?: boolean
}) {
  const t = useTranslations('v2.teacher.tcChecklist.import')
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const patchModule = (mi: number, patch: Partial<DraftModule>) =>
    onChange(modules.map((m, i) => (i === mi ? { ...m, ...patch } : m)))

  const patchLesson = (mi: number, li: number, patch: Partial<DraftLesson>) =>
    onChange(
      modules.map((m, i) =>
        i === mi ? { ...m, lessons: m.lessons.map((l, j) => (j === li ? { ...l, ...patch } : l)) } : m,
      ),
    )

  const toggleModule = (id: string, on: boolean) =>
    onSelectionChange({ ...selection, modules: { ...selection.modules, [id]: on } })

  const toggleLesson = (id: string, on: boolean) =>
    onSelectionChange({ ...selection, lessons: { ...selection.lessons, [id]: on } })

  return (
    <ul className="flex flex-col gap-2.5" aria-label={t('previewListLabel')}>
      {modules.map((m, mi) => {
        const isOpen = open[m.clientId] ?? mi === 0
        const included = selection.modules[m.clientId] !== false
        const kept = m.lessons.filter((l) => selection.lessons[l.clientId] !== false).length

        return (
          <li
            key={m.clientId}
            className={`rounded-ga border border-ga-line bg-ga-card ${included ? '' : 'opacity-55'}`}
          >
            <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              <input
                type="checkbox"
                checked={included}
                disabled={disabled}
                aria-label={t('includeModule', { title: m.title })}
                onChange={(e) => toggleModule(m.clientId, e.target.checked)}
                className="h-4 w-4 shrink-0 accent-ga-accent"
              />
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [m.clientId]: !isOpen }))}
                aria-expanded={isOpen}
                aria-label={isOpen ? t('collapseModule') : t('expandModule')}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-ga text-ga-subtle hover:bg-ga-surface hover:text-ga-ink"
              >
                {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </button>
              <input
                value={m.title}
                disabled={disabled || !included}
                aria-label={t('moduleTitleLabel')}
                onChange={(e) => patchModule(mi, { title: e.target.value })}
                className={`min-w-0 flex-1 ${fieldCls} font-semibold`}
              />
              <span className="ga-ui shrink-0 text-[11.5px] uppercase tracking-[0.05em] text-ga-muted">
                {m.kind === 'REVIEW' ? t('kindReview') : t('kindChapter')}
              </span>
              {m.sourcePageFrom != null && (
                <span className="ga-ui shrink-0 text-[11.5px] text-ga-subtle">
                  {t('sourcePages', { from: m.sourcePageFrom, to: m.sourcePageTo ?? m.sourcePageFrom })}
                </span>
              )}
              <span className="ga-ui shrink-0 text-[11.5px] text-ga-subtle">
                {t('lessonCount', { count: kept })}
              </span>
            </div>

            {isOpen && (
              <ul className="flex flex-col gap-2 border-t border-ga-line px-3 py-3">
                {m.lessons.map((l, li) => (
                  <LessonRow
                    key={l.clientId}
                    lesson={l}
                    disabled={disabled || !included}
                    included={selection.lessons[l.clientId] !== false}
                    onToggle={(on) => toggleLesson(l.clientId, on)}
                    onChange={(patch) => patchLesson(mi, li, patch)}
                  />
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function LessonRow({
  lesson,
  included,
  disabled,
  onToggle,
  onChange,
}: {
  lesson: DraftLesson
  included: boolean
  disabled?: boolean
  onToggle: (on: boolean) => void
  onChange: (patch: Partial<DraftLesson>) => void
}) {
  const t = useTranslations('v2.teacher.tcChecklist.import')
  const rowDisabled = disabled || !included

  return (
    <li className={`rounded-ga border border-ga-line bg-ga-bg p-2.5 ${included ? '' : 'opacity-55'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="checkbox"
          checked={included}
          disabled={disabled}
          aria-label={t('includeLesson', { title: lesson.title })}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-4 w-4 shrink-0 accent-ga-accent"
        />
        <input
          value={lesson.title}
          disabled={rowDisabled}
          aria-label={t('lessonTitleLabel')}
          onChange={(e) => onChange({ title: e.target.value })}
          className={`min-w-0 flex-1 ${fieldCls}`}
        />
        <span className="ga-ui shrink-0 text-[11.5px] text-ga-subtle">
          {t('unitsShort', { count: lesson.estimatedUnits ?? 0 })}
        </span>
        {lesson.sourcePageFrom != null && (
          <span className="ga-ui shrink-0 text-[11.5px] text-ga-subtle">
            {t('sourcePages', {
              from: lesson.sourcePageFrom,
              to: lesson.sourcePageTo ?? lesson.sourcePageFrom,
            })}
          </span>
        )}
      </div>

      <EditableList
        legend={t('knowledgeHeading')}
        addLabel={t('addKnowledge')}
        rows={lesson.knowledgePoints}
        disabled={rowDisabled}
        onChange={(knowledgePoints) => onChange({ knowledgePoints })}
        emptyRow={() => ({ text: '', skillTag: null, contentTag: null })}
        renderTags={(row, patch) => (
          <>
            <select
              aria-label={t('skillTagLabel')}
              value={row.skillTag ?? ''}
              disabled={rowDisabled}
              onChange={(e) => patch({ skillTag: e.target.value || null })}
              className={tagSelectCls}
            >
              <option value="">{t('tagNone')}</option>
              {SKILL_TAG_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <select
              aria-label={t('contentTagLabel')}
              value={row.contentTag ?? ''}
              disabled={rowDisabled}
              onChange={(e) => patch({ contentTag: e.target.value || null })}
              className={tagSelectCls}
            >
              <option value="">{t('tagNone')}</option>
              {CONTENT_TAG_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </>
        )}
      />

      <EditableList
        legend={t('canDoHeading')}
        addLabel={t('addCanDo')}
        rows={lesson.canDoStatements}
        disabled={rowDisabled}
        onChange={(canDoStatements) => onChange({ canDoStatements })}
        emptyRow={() => ({ text: '', cefrLevel: lesson.cefrLevel, skillTag: null })}
        renderTags={(row, patch) => (
          <select
            aria-label={t('skillTagLabel')}
            value={row.skillTag ?? ''}
            disabled={rowDisabled}
            onChange={(e) => patch({ skillTag: e.target.value || null })}
            className={tagSelectCls}
          >
            <option value="">{t('tagNone')}</option>
            {SKILL_TAG_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        )}
      />
    </li>
  )
}

/**
 * A small add/remove list of text rows with optional tag selects.
 *
 * Focus is moved deliberately on add and remove — a keyboard or screen-reader user who adds a row
 * lands in it, and one who deletes a row lands on its neighbour instead of at the top of the modal.
 */
function EditableList<T extends { text: string }>({
  legend,
  addLabel,
  rows,
  disabled,
  onChange,
  emptyRow,
  renderTags,
}: {
  legend: string
  addLabel: string
  rows: T[]
  disabled?: boolean
  onChange: (next: T[]) => void
  emptyRow: () => T
  renderTags: (row: T, patch: (p: Partial<T>) => void) => React.ReactNode
}) {
  const t = useTranslations('v2.teacher.tcChecklist.import')
  const inputs = useRef<Array<HTMLInputElement | null>>([])
  const pendingFocus = useRef<number | null>(null)

  useEffect(() => {
    if (pendingFocus.current !== null) {
      inputs.current[pendingFocus.current]?.focus()
      pendingFocus.current = null
    }
  })

  const patchAt = (i: number, patch: Partial<T>) =>
    onChange(rows.map((r, j) => (i === j ? { ...r, ...patch } : r)))

  const removeAt = (i: number) => {
    pendingFocus.current = Math.max(0, i - 1)
    onChange(rows.filter((_, j) => j !== i))
  }

  const addRow = () => {
    pendingFocus.current = rows.length
    onChange([...rows, emptyRow()])
  }

  return (
    <fieldset className="mt-2.5 border-0 p-0">
      <legend className="ga-ui mb-1 block text-[11px] font-bold uppercase tracking-[0.05em] text-ga-muted">
        {legend}
      </legend>
      <div className="flex flex-col gap-1.5">
        {rows.map((row, i) => (
          <div key={i} className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
            <input
              ref={(el) => {
                inputs.current[i] = el
              }}
              value={row.text}
              disabled={disabled}
              aria-label={`${legend} ${i + 1}`}
              onChange={(e) => patchAt(i, { text: e.target.value } as Partial<T>)}
              className={`min-w-0 sm:flex-1 ${fieldCls}`}
            />
            <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:flex-nowrap">
              {renderTags(row, (p) => patchAt(i, p))}
              <button
                type="button"
                onClick={() => removeAt(i)}
                disabled={disabled}
                aria-label={t('removeRow', { label: legend, index: i + 1 })}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-ga text-ga-subtle hover:bg-ga-surface hover:text-ga-ink disabled:opacity-50"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addRow}
          disabled={disabled}
          className="ga-ui inline-flex w-fit items-center gap-1 rounded-ga px-1 py-0.5 text-[12px] font-semibold text-ga-accent hover:underline disabled:opacity-50"
        >
          <Plus size={13} /> {addLabel}
        </button>
      </div>
    </fieldset>
  )
}
