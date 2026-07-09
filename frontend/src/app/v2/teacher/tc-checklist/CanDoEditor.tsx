'use client'

// Kann-Beschreibung editor (Phase 1e): authors a lesson's "Ich kann …" competency targets.
// Mirrors KnowledgePointsEditor (text + optional tags per row) but tags are CEFR + skill.
// Self-contained + its pure seed/payload helpers live here to keep the tc-checklist page lean.

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, X } from 'lucide-react'
import type { CanDoStatement } from '@/lib/studentClassesApi'
import type { CanDoStatementInput } from '@/lib/teacherLessonsApi'

const SKILL_TAG_OPTIONS = ['HOEREN', 'LESEN', 'SCHREIBEN', 'SPRECHEN'] as const
const CEFR_OPTIONS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
const VIOLET = 'var(--ga-violet)'
const fieldCls =
  'w-full rounded-ga border border-ga-line bg-ga-bg px-3 py-2 text-[13.5px] text-ga-ink outline-none focus:border-ga-accent'

/** An editable can-do row ('' tag = none). */
export interface EditableCanDo {
  text: string
  cefrLevel: string
  skillTag: string
}

export const emptyCanDo = (): EditableCanDo => ({ text: '', cefrLevel: '', skillTag: '' })

/** Seed the editor from a lesson's can-do statements (always at least one blank row). */
export function seedEditableCanDos(statements: CanDoStatement[] | undefined | null): EditableCanDo[] {
  const rows = (statements ?? []).map((c) => ({
    text: c.text,
    cefrLevel: c.cefrLevel ?? '',
    skillTag: c.skillTag ?? '',
  }))
  return rows.length ? rows : [emptyCanDo()]
}

/** Editor rows → API payload: drop empty-text rows, map '' tag → null. */
export function toCanDoPayload(rows: EditableCanDo[]): CanDoStatementInput[] {
  return rows
    .map((r) => ({ text: r.text.trim(), cefrLevel: r.cefrLevel || null, skillTag: r.skillTag || null }))
    .filter((r) => r.text.length > 0)
}

export function CanDoEditor({ value, onChange }: { value: EditableCanDo[]; onChange: (next: EditableCanDo[]) => void }) {
  const t = useTranslations('v2.teacher.tcChecklist')
  const inputs = useRef<Array<HTMLInputElement | null>>([])
  const pendingFocus = useRef<number | null>(null)

  useEffect(() => {
    if (pendingFocus.current !== null) {
      inputs.current[pendingFocus.current]?.focus()
      pendingFocus.current = null
    }
  })

  const setAt = (i: number, patch: Partial<EditableCanDo>) =>
    onChange(value.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const removeAt = (i: number) => {
    if (value.length <= 1) {
      pendingFocus.current = 0
      onChange([emptyCanDo()])
      return
    }
    pendingFocus.current = Math.max(0, i - 1)
    onChange(value.filter((_, idx) => idx !== i))
  }
  const addRow = () => {
    pendingFocus.current = value.length
    onChange([...value, emptyCanDo()])
  }

  const selCls = `${fieldCls} w-auto py-1.5 text-[12px]`

  return (
    <div className="flex flex-col gap-2.5">
      {value.map((r, i) => (
        <div key={i} className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 sm:flex-1">
            <span className="w-4 shrink-0 text-right text-[12.5px] text-ga-subtle" aria-hidden>{i + 1}.</span>
            <input
              ref={(el) => {
                inputs.current[i] = el
              }}
              value={r.text}
              aria-label={t('canDo.itemLabel', { index: i + 1 })}
              onChange={(e) => setAt(i, { text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addRow()
                }
              }}
              placeholder={t('canDo.placeholder')}
              className={`flex-1 ${fieldCls}`}
            />
          </div>
          <div className="flex items-center gap-2 pl-6 sm:shrink-0 sm:pl-0">
            <select aria-label={t('canDo.cefrLabel')} value={r.cefrLevel} onChange={(e) => setAt(i, { cefrLevel: e.target.value })} className={selCls}>
              <option value="">{t('canDo.cefrLabel')}: {t('tagNone')}</option>
              {CEFR_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <select aria-label={t('canDo.skillLabel')} value={r.skillTag} onChange={(e) => setAt(i, { skillTag: e.target.value })} className={selCls}>
              <option value="">{t('canDo.skillLabel')}: {t('tagNone')}</option>
              {SKILL_TAG_OPTIONS.map((o) => (
                <option key={o} value={o}>{t(`skillTags.${o}`)}</option>
              ))}
            </select>
            <button
              type="button"
              aria-label={t('canDo.remove')}
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
        <Plus size={14} /> {t('canDo.add')}
      </button>
    </div>
  )
}
