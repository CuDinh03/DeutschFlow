'use client'

import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Lock, LockOpen, Pencil, RefreshCw, Save, Sparkles } from 'lucide-react'
import {
  DIFFICULTY_LABEL,
  generateItems, patchDraft, regenerateItem,
  type DifficultyLevel, type OptionKey, type StudioItem,
} from '@/lib/adminExamStudioApi'
import { DIFFICULTY_ORDER, countByLevel } from '@/lib/examStudioLogic'
import { GaBtn, GaCap, GaCard, TkBadge } from '@/components/ui-v2'
import { cn } from '@/lib/utils'
import { LightDot, Note, studioField, studioMiniBtn, type StudioStepProps } from './ui'

const OPTION_KEYS: OptionKey[] = ['a', 'b', 'c']

/** Bước 4 — Câu hỏi theo ma trận độ khó: sinh, đo lại bậc, sinh lại từng câu, khoá, sửa tay. */
export function StepItems({ draft, locked, run, onNext }: StudioStepProps & { onNext: () => void }) {
  const t = useTranslations('v2.adminContent.examStudio')
  const planned = draft.difficultyPlan
  const target = countByLevel(draft.items, 'target')
  const measured = countByLevel(draft.items, 'measured')
  const allLocked = draft.items.length > 0 && draft.items.every((i) => i.locked)

  const saveItem = (next: StudioItem) =>
    run(() => patchDraft(draft.id, { items: draft.items.map((it) => (it.id === next.id ? next : it)) }), t('saved'))

  return (
    <div className="flex flex-col gap-4">
      <GaCard className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <GaBtn variant="yellow" size="sm" disabled={locked || !draft.text || allLocked} onClick={() => run(() => generateItems(draft.id))}>
            <Sparkles size={14} aria-hidden /> {draft.items.length ? t('items.regenerateAll') : t('items.generate')}
          </GaBtn>
          <span className="ga-ui text-ga-caption text-ga-muted">{t('items.generateHint')}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="ga-ui w-full min-w-[420px] text-ga-small">
            <caption className="sr-only">{t('items.matrixCaption')}</caption>
            <thead>
              <tr className="text-left text-ga-caption text-ga-muted">
                <th scope="col" className="py-1 pr-3 font-semibold" />
                {DIFFICULTY_ORDER.map((lv) => <th key={lv} scope="col" className="px-2 py-1 text-center font-semibold">{DIFFICULTY_LABEL[lv]}</th>)}
              </tr>
            </thead>
            <tbody>
              {([
                ['planned', planned],
                ['target', target],
                ['measured', measured],
              ] as const).map(([row, counts]) => (
                <tr key={row} className="border-t border-ga-line">
                  <th scope="row" className="py-1.5 pr-3 text-left font-semibold text-ga-muted">{t(`items.row.${row}`)}</th>
                  {DIFFICULTY_ORDER.map((lv) => {
                    const off = row !== 'planned' && draft.items.length > 0 && counts[lv] !== planned[lv]
                    return (
                      <td key={lv} className={cn('px-2 py-1.5 text-center font-semibold', off ? 'text-ga-gold' : 'text-ga-ink')}>
                        {counts[lv]}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GaCard>

      {draft.items.length === 0 ? (
        <p className="ga-ui rounded-ga border border-dashed border-ga-line px-4 py-8 text-center text-ga-small text-ga-muted">
          {draft.text ? t('items.empty') : t('items.needText')}
        </p>
      ) : (
        draft.items.map((it, i) => (
          <ItemCard
            key={it.id}
            item={it}
            index={i}
            locked={locked}
            onSave={saveItem}
            onRegenerate={(lv) => run(() => regenerateItem(draft.id, it.id, lv))}
          />
        ))
      )}

      <div>
        <GaBtn variant="primary" size="sm" disabled={draft.items.length === 0} onClick={onNext}>{t('next')}</GaBtn>
      </div>
    </div>
  )
}

function ItemCard({
  item, index, locked, onSave, onRegenerate,
}: {
  item: StudioItem
  index: number
  locked: boolean
  onSave: (next: StudioItem) => Promise<boolean>
  onRegenerate: (level?: DifficultyLevel) => void
}) {
  const t = useTranslations('v2.adminContent.examStudio')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(item)
  const m = item.difficultyMeasured
  const mismatch = m != null && m.level !== item.difficultyTarget
  const busy = locked || item.locked
  const headingId = `item-${item.id}-h`

  const startEdit = () => { setForm(item); setEditing(true) }
  const save = async () => { if (await onSave(form)) setEditing(false) }

  const scoreTitle = m
    ? (['phrasing', 'evidence', 'distractors', 'language'] as const).map((k) => `${t(`score.${k}`)}: ${m.scores[k]}/2`).join(' · ')
    : undefined

  return (
    <GaCard className="flex flex-col gap-3 p-4 sm:p-5" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-center gap-2">
        <LightDot light={item.light} />
        <h3 id={headingId} className="ga-ui text-ga-h3 text-ga-ink">{t('items.itemN', { n: index + 1 })}</h3>
        <span className="ga-ui text-ga-caption text-ga-muted">{item.id}</span>
        <TkBadge tone={mismatch ? 'yellow' : 'navy'} title={scoreTitle}>
          {m
            ? t('items.difficulty', { target: DIFFICULTY_LABEL[item.difficultyTarget], measured: DIFFICULTY_LABEL[m.level], total: m.total })
            : t('items.difficultyUnmeasured', { target: DIFFICULTY_LABEL[item.difficultyTarget] })}
        </TkBadge>
        {item.locked && <TkBadge tone="neutral"><Lock size={11} aria-hidden /> {t('items.lockedBadge')}</TkBadge>}
      </div>

      {m && (
        <details className="ga-ui text-ga-caption text-ga-muted">
          <summary className="cursor-pointer font-semibold">{t('items.scoreDetails')}</summary>
          <ul className="mt-1.5 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {(['phrasing', 'evidence', 'distractors', 'language'] as const).map((k) => (
              <li key={k}>{t(`score.${k}`)}: <span className="font-semibold text-ga-ink">{m.scores[k]}/2</span></li>
            ))}
          </ul>
          {m.hint && <p className="mt-1.5 text-ga-gold">{m.hint}</p>}
        </details>
      )}

      {item.flags.length > 0 && (
        <ul className="flex flex-col gap-1">
          {item.flags.map((f, i) => <li key={i}><Note tone={item.light === 'RED' ? 'red' : 'yellow'}>{f}</Note></li>)}
        </ul>
      )}

      {editing ? (
        <div className="flex flex-col gap-2.5">
          <Field id={`${item.id}-q`} label={t('items.question')}>
            <textarea id={`${item.id}-q`} lang="de" rows={2} className={studioField} value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })} />
          </Field>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1"><GaCap>{t('items.options')}</GaCap></legend>
            {OPTION_KEYS.map((k) => (
              <div key={k} className="flex items-center gap-2">
                <input type="radio" name={`${item.id}-correct`} checked={form.correct === k}
                  aria-label={t('items.markCorrect', { k })} onChange={() => setForm({ ...form, correct: k })}
                  style={{ accentColor: 'var(--ga-green)' }} />
                <span className="w-4 font-semibold text-ga-muted">{k}</span>
                <input lang="de" className={studioField} value={form.options[k]} aria-label={t('items.optionN', { k })}
                  onChange={(e) => setForm({ ...form, options: { ...form.options, [k]: e.target.value } })} />
              </div>
            ))}
          </fieldset>
          <Field id={`${item.id}-ev`} label={t('items.evidence')}>
            <textarea id={`${item.id}-ev`} lang="de" rows={2} className={studioField} value={form.evidence}
              onChange={(e) => setForm({ ...form, evidence: e.target.value })} />
          </Field>
          <Field id={`${item.id}-ex`} label={t('items.explanation')}>
            <textarea id={`${item.id}-ex`} rows={3} className={studioField} value={form.explanationVi}
              onChange={(e) => setForm({ ...form, explanationVi: e.target.value })} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <GaBtn variant="primary" size="sm" disabled={locked} onClick={save}><Save size={14} aria-hidden /> {t('items.saveEdit')}</GaBtn>
            <GaBtn variant="ghost" size="sm" onClick={() => setEditing(false)}>{t('cancel')}</GaBtn>
          </div>
        </div>
      ) : (
        <>
          <p className="text-ga-body font-semibold text-ga-ink" lang="de">{item.question}</p>
          <ul className="flex flex-col gap-1" lang="de">
            {OPTION_KEYS.map((k) => {
              const trap = item.traps.find((tr) => tr.option === k)
              const right = item.correct === k
              return (
                <li key={k} className={cn('flex flex-col gap-0.5 rounded-ga px-2.5 py-1.5 text-ga-body',
                  right ? 'bg-ga-green-soft' : 'bg-ga-surface')}>
                  <span className="flex items-start gap-2 text-ga-ink">
                    <span className="w-4 shrink-0 font-semibold text-ga-muted">{k}</span>
                    <span className="min-w-0 flex-1">{item.options[k]}</span>
                    {right && <TkBadge tone="green" lang="vi">{t('preview.correct')}</TkBadge>}
                  </span>
                  {trap && (
                    <span className="ga-ui pl-6 text-ga-caption text-ga-muted" lang="vi">{t('items.trap', { rule: trap.rule })}</span>
                  )}
                </li>
              )
            })}
          </ul>
          {item.evidence && (
            <blockquote className="border-l-2 border-ga-accent bg-ga-surface px-3 py-2 text-ga-small text-ga-ink" lang="de">
              <span className="ga-ui mb-0.5 block text-ga-caption font-semibold text-ga-muted" lang="vi">{t('items.evidence')}</span>
              {item.evidence}
            </blockquote>
          )}
          {item.explanationVi && (
            <p className="ga-ui text-ga-small text-ga-muted">
              <span className="font-semibold text-ga-ink">{t('items.explanation')}: </span>{item.explanationVi}
            </p>
          )}
        </>
      )}

      {!editing && (
        <div className="flex flex-wrap items-center gap-2 border-t border-ga-line pt-3">
          <label className="ga-ui flex items-center gap-1.5 text-ga-caption text-ga-muted">
            {t('items.changeLevel')}
            <select
              className="ga-ui min-h-9 rounded-ga border border-ga-line bg-ga-bg px-2 text-ga-caption text-ga-ink disabled:opacity-50"
              value={item.difficultyTarget}
              disabled={busy}
              onChange={(e) => onRegenerate(e.target.value as DifficultyLevel)}
            >
              {DIFFICULTY_ORDER.map((lv) => <option key={lv} value={lv}>{DIFFICULTY_LABEL[lv]}</option>)}
            </select>
          </label>
          <button type="button" className={studioMiniBtn} disabled={busy} onClick={() => onRegenerate()}>
            <RefreshCw size={13} aria-hidden /> {t('items.regenerate')}
          </button>
          <button type="button" className={studioMiniBtn} disabled={locked} aria-pressed={item.locked}
            onClick={() => void onSave({ ...item, locked: !item.locked })}>
            {item.locked ? <LockOpen size={13} aria-hidden /> : <Lock size={13} aria-hidden />}
            {item.locked ? t('items.unlock') : t('items.lock')}
          </button>
          <button type="button" className={studioMiniBtn} disabled={locked} onClick={startEdit}>
            <Pencil size={13} aria-hidden /> {t('items.edit')}
          </button>
        </div>
      )}
    </GaCard>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block"><GaCap>{label}</GaCap></label>
      {children}
    </div>
  )
}

