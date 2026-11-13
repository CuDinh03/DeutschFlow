'use client'

import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Lock, LockOpen, Pencil, RefreshCw, Save, Sparkles } from 'lucide-react'
import {
  DIFFICULTY_LABEL,
  generateItems, patchDraft, regenerateItem,
  type DifficultyLevel, type OptionKey, type StudioItem,
} from '@/lib/adminExamStudioApi'
import {
  DIFFICULTY_ORDER, countByLevel, hasHeadlineIssues, headlineIssues, headlineTable, isGapKind, isHoerenKind, itemNumber,
  hasDigits, joinAccept, matchTextIndex, normalizeHeadline, optionKeys, splitAccept, splitMatchTexts, teilKind, type TeilKind,
} from '@/lib/examStudioLogic'
import { GaBtn, GaCap, GaCard, TkBadge } from '@/components/ui-v2'
import { cn } from '@/lib/utils'
import { LightDot, Note, studioField, studioMiniBtn, type StudioStepProps } from './ui'
import { AdRoleTable, FormItemsPanel, GapLetterPanel, TrueFalseSummary, WordBankTable } from './ItemsSituational'
import { HoerenAnswerSummary, hoerenSegmentOf } from './HoerenParts'

/** Phương án dạng bản đồ chuỗi: T2 có a/b/c, T1 có 2 chữ trong a–j (type cũ chỉ khai a|b|c). */
const optsOf = (it: Pick<StudioItem, 'options'>) => it.options as Record<string, string>
const EXCERPT_CHARS = 220
const excerpt = (s: string) => (s.length > EXCERPT_CHARS ? `${s.slice(0, EXCERPT_CHARS).trimEnd()}…` : s)

/** Bước 4 — Câu hỏi theo ma trận độ khó: sinh, đo lại bậc, sinh lại từng câu, khoá, sửa tay. */
export function StepItems({ draft, locked, run, onNext }: StudioStepProps & { onNext: () => void }) {
  const t = useTranslations('v2.adminContent.examStudio')
  const planned = draft.difficultyPlan
  const target = countByLevel(draft.items, 'target')
  const measured = countByLevel(draft.items, 'measured')
  const allLocked = draft.items.length > 0 && draft.items.every((i) => i.locked)
  const kind = teilKind(draft.teilType)
  const match = kind === 'MATCH_HEADLINE'
  const gap = isGapKind(kind)
  const texts = match ? splitMatchTexts(draft.text?.context, draft.itemCount) : []

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
        {gap && <p className="ga-ui text-ga-caption text-ga-muted">{t('items.gapRegenHint')}</p>}

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

      {match && draft.items.length > 0 && <HeadlineTable items={draft.items} />}
      {kind === 'MATCH_AD_X' && draft.items.length > 0 && <AdRoleTable draft={draft} />}
      {kind === 'TRUE_FALSE' && draft.items.length > 0 && <TrueFalseSummary draft={draft} />}
      {isHoerenKind(kind) && draft.items.length > 0 && <HoerenAnswerSummary draft={draft} />}
      {kind === 'FILL_FORM' && draft.items.length > 0 && <FormItemsPanel draft={draft} />}
      {gap && draft.items.length > 0 && <GapLetterPanel draft={draft} />}
      {kind === 'GAP_WORDBANK' && draft.items.length > 0 && <WordBankTable draft={draft} />}

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
            match={match}
            kind={kind}
            excerptText={match ? excerpt(texts[matchTextIndex(it.id, i)] ?? '')
              // Hören T1/T3: đoạn lời thoại của đúng câu này, để đọc đối chiếu khi sửa mệnh đề.
              : hoerenSegmentOf(draft, kind, it.id, i)?.text}
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
  item, index, match, kind, excerptText, locked, onSave, onRegenerate,
}: {
  item: StudioItem
  index: number
  /** Lesen T1: câu = "Text i", 2 tiêu đề (đúng + nhiễu). */
  match: boolean
  kind: TeilKind
  excerptText?: string
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
  const gap = isGapKind(kind)
  const adX = kind === 'MATCH_AD_X'
  // SB2: phương án là từ trong hộp (máy dựng) — không sửa chữ ở đây, chỉ sửa giải thích/bằng chứng.
  // A2: richtig/falsch cố định (chỉ đổi đáp án); form không có phương án (đáp án + cách viết khác ở `meta.accept`).
  const trueFalse = kind === 'TRUE_FALSE' || isHoerenKind(kind)
  const fillForm = kind === 'FILL_FORM'
  // `correct` khai OptionKey (a–o, x) nhưng A2 dùng cả "richtig"/"falsch" và chữ tự do của ô form.
  const correctStr = item.correct as string
  const optionsEditable = kind !== 'GAP_WORDBANK' && !trueFalse
  /** Lựa chọn đáp án khi sửa tay: khoá của câu, LV3 thêm `x`. */
  const answerKeys = (o: Record<string, string>) => (adX ? Array.from(new Set([...optionKeys(o), 'x'])) : optionKeys(o))
  const number = kind === 'ARTICLE' || match ? index + 1 : Number(item.meta?.gap ?? itemNumber(item.id, index + 1))

  const startEdit = () => { setForm(item); setEditing(true) }
  const save = async () => { if (await onSave(form)) setEditing(false) }

  const scoreTitle = m
    ? (['phrasing', 'evidence', 'distractors', 'language'] as const).map((k) => `${t(`score.${k}`)}: ${m.scores[k]}/2`).join(' · ')
    : undefined

  return (
    <GaCard id={`item-card-${item.id}`} tabIndex={-1} className="flex scroll-mt-4 flex-col gap-3 p-4 outline-none focus-visible:ring-2 focus-visible:ring-ga-focus sm:p-5" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-center gap-2">
        <LightDot light={item.light} />
        <h3 id={headingId} className="ga-ui text-ga-h3 text-ga-ink">{gap ? t('items.gapN', { n: number }) : t('items.itemN', { n: number })}</h3>
        <span className="ga-ui text-ga-caption text-ga-muted">{item.id}</span>
        <TkBadge tone={mismatch ? 'yellow' : 'navy'} title={scoreTitle}>
          {m
            ? t('items.difficulty', { target: DIFFICULTY_LABEL[item.difficultyTarget], measured: DIFFICULTY_LABEL[m.level], total: m.total })
            : t('items.difficultyUnmeasured', { target: DIFFICULTY_LABEL[item.difficultyTarget] })}
        </TkBadge>
        {item.locked && <TkBadge tone="neutral"><Lock size={11} aria-hidden /> {t('items.lockedBadge')}</TkBadge>}
        {gap && item.meta?.phenomenon && <TkBadge tone="violet">{item.meta.phenomenon}</TkBadge>}
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
          {!match && (
            <Field id={`${item.id}-q`} label={fillForm ? t('items.formField') : t('items.question')}>
              <textarea id={`${item.id}-q`} lang="de" rows={2} className={studioField} value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })} />
            </Field>
          )}
          {fillForm ? (
            <>
              <Field id={`${item.id}-ans`} label={t('items.formAnswer')}>
                <input id={`${item.id}-ans`} lang="de" className={studioField} value={form.correct ?? ''}
                  onChange={(e) => setForm({ ...form, correct: e.target.value as OptionKey })} />
              </Field>
              <Field id={`${item.id}-acc`} label={t('items.formAccept')}>
                <input id={`${item.id}-acc`} lang="de" className={studioField} value={splitAccept(form.meta?.accept).join(', ')}
                  aria-describedby={`${item.id}-acc-hint`}
                  onChange={(e) => setForm({ ...form, meta: { ...(form.meta ?? {}), accept: joinAccept(e.target.value.split(',')) } })} />
                <p id={`${item.id}-acc-hint`} className="ga-ui mt-1 text-ga-caption text-ga-muted">{t('items.formAcceptHint')}</p>
              </Field>
            </>
          ) : (
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1"><GaCap>{match ? t('items.headlinesLegend') : t('items.options')}</GaCap></legend>
            {!optionsEditable && !trueFalse && <p className="ga-ui text-ga-caption text-ga-muted">{t('items.bankReadOnly')}</p>}
            {answerKeys(optsOf(form)).map((k) => (
              <div key={k} className="flex items-center gap-2">
                <input type="radio" name={`${item.id}-correct`} checked={form.correct === k} disabled={!optionsEditable && !trueFalse}
                  aria-label={t('items.markCorrect', { k })} onChange={() => setForm({ ...form, correct: k as OptionKey })}
                  style={{ accentColor: 'var(--ga-green)' }} />
                <span className="w-4 font-semibold text-ga-muted">{k}</span>
                {k === 'x' && adX && !(k in optsOf(form)) ? (
                  <span className="ga-ui text-ga-small text-ga-muted">{t('items.adNone')}</span>
                ) : (
                  <input lang="de" className={studioField} value={optsOf(form)[k] ?? ''} aria-label={t('items.optionN', { k })}
                    disabled={!optionsEditable}
                    onChange={(e) => setForm({ ...form, options: { ...optsOf(form), [k]: e.target.value } as StudioItem['options'] })} />
                )}
              </div>
            ))}
          </fieldset>
          )}
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
          {adX && item.correct === 'x' && (
            <p className="ga-ui rounded-ga bg-ga-green-soft px-2.5 py-1.5 text-ga-small font-semibold text-ga-green">{t('items.adAnswerX')}</p>
          )}
          {(match || isHoerenKind(kind)) && excerptText != null && (
            <p className="whitespace-pre-line rounded-ga border border-ga-line px-3 py-2 text-ga-small text-ga-muted" lang="de">
              {excerptText || t('preview.noText')}
            </p>
          )}
          {fillForm && (
            <div className="ga-ui flex flex-col gap-1 rounded-ga bg-ga-green-soft px-2.5 py-1.5 text-ga-small">
              <span className="font-semibold text-ga-green">{t('items.formAnswerIs', { answer: item.correct || '—' })}</span>
              {splitAccept(item.meta?.accept).length > 0 && (
                <span className="text-ga-muted">{t('items.formAcceptIs', { list: splitAccept(item.meta?.accept).join(', ') })}</span>
              )}
              {hasDigits(item.correct) && <span className="text-ga-gold">{t('items.formDigits')}</span>}
            </div>
          )}
          {trueFalse && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('items.tfPick')}>
              {(['richtig', 'falsch'] as const).map((v) => (
                <button key={v} type="button" aria-pressed={correctStr === v} disabled={locked || item.locked}
                  onClick={() => { if (correctStr !== v) void onSave({ ...item, correct: v as unknown as OptionKey }) }}
                  className={cn('ga-ui min-h-9 rounded-ga border px-3 text-ga-small font-semibold disabled:opacity-60',
                    correctStr === v ? 'border-ga-green bg-ga-green-soft text-ga-green' : 'border-ga-line bg-ga-card text-ga-ink hover:bg-ga-surface')}>
                  {v}
                </button>
              ))}
            </div>
          )}
          {!fillForm && !trueFalse && (
          <ul className="flex flex-col gap-1" lang="de">
            {optionKeys(optsOf(item)).map((k) => {
              const trap = item.traps.find((tr) => tr.option === k)
              const right = item.correct === k
              return (
                <li key={k} className={cn('flex flex-col gap-0.5 rounded-ga px-2.5 py-1.5 text-ga-body',
                  right ? 'bg-ga-green-soft' : 'bg-ga-surface')}>
                  <span className="flex items-start gap-2 text-ga-ink">
                    <span className="w-4 shrink-0 font-semibold text-ga-muted">{k}</span>
                    <span className="min-w-0 flex-1">{optsOf(item)[k]}</span>
                    {right && <TkBadge tone="green" lang="vi">{match ? t('items.headlineRight') : t('preview.correct')}</TkBadge>}
                    {!right && match && <TkBadge tone="yellow" lang="vi">{t('items.headlineDistractor')}</TkBadge>}
                    {!right && adX && <TkBadge tone="yellow" lang="vi">{t('items.adDistractor')}</TkBadge>}
                  </span>
                  {trap && (
                    <span className="ga-ui pl-6 text-ga-caption text-ga-muted" lang="vi">{t('items.trap', { rule: trap.rule })}</span>
                  )}
                </li>
              )
            })}
          </ul>
          )}
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

/** Lesen T1: bảng 10 tiêu đề a–j gộp từ 5 câu; đỏ khi trùng chữ / trùng nội dung / thiếu chữ. */
function HeadlineTable({ items }: { items: StudioItem[] }) {
  const t = useTranslations('v2.adminContent.examStudio')
  const asMap = items.map((it) => ({ id: it.id, options: optsOf(it), correct: it.correct }))
  const rows = headlineTable(asMap)
  const issues = headlineIssues(asMap)
  const dupLetters = new Set(issues.duplicateLetters)
  const dupTexts = new Set(issues.duplicateTexts.map(normalizeHeadline))

  return (
    <GaCard className="flex flex-col gap-2 p-4 sm:p-5">
      <h3><GaCap>{t('items.headlineTable')}</GaCap></h3>
      {hasHeadlineIssues(issues) && (
        <div className="flex flex-col gap-1">
          {issues.duplicateLetters.length > 0 && <Note tone="red">{t('items.dupLetters', { list: issues.duplicateLetters.join(', ') })}</Note>}
          {issues.duplicateTexts.length > 0 && <Note tone="red">{t('items.dupTexts', { list: issues.duplicateTexts.join(' · ') })}</Note>}
          {issues.missingLetters.length > 0 && <Note tone="red">{t('items.missingLetters', { list: issues.missingLetters.join(', ') })}</Note>}
          {issues.invalidLetters.length > 0 && <Note tone="red">{t('items.invalidLetters', { list: issues.invalidLetters.join(', ') })}</Note>}
          {issues.badItems.length > 0 && <Note tone="red">{t('items.badItems', { list: issues.badItems.join(', ') })}</Note>}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="ga-ui w-full min-w-[420px] text-ga-small">
          <caption className="sr-only">{t('items.headlineTable')}</caption>
          <thead>
            <tr className="text-left text-ga-caption text-ga-muted">
              <th scope="col" className="w-8 py-1 pr-2 font-semibold">{t('items.colLetter')}</th>
              <th scope="col" className="py-1 pr-2 font-semibold">{t('items.colHeadline')}</th>
              <th scope="col" className="py-1 font-semibold">{t('items.colRole')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const bad = dupLetters.has(r.letter) || dupTexts.has(normalizeHeadline(r.text))
              return (
                <tr key={`${r.letter}-${r.itemId}`} className={cn('border-t border-ga-line', bad && 'bg-ga-red-soft')}>
                  <td className={cn('py-1.5 pr-2 font-semibold', bad ? 'text-ga-red' : 'text-ga-ink')}>{r.letter}</td>
                  <td className="py-1.5 pr-2 text-ga-ink" lang="de">{r.text}</td>
                  <td className="py-1.5 text-ga-muted">
                    {r.correct
                      ? t('items.roleRight', { n: r.itemIndex + 1 })
                      : t('items.roleDistractor', { n: r.itemIndex + 1 })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
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

