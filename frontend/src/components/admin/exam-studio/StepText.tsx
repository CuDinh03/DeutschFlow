'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Save, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { patchDraft, writeText, type StudioDraft, type StudioText } from '@/lib/adminExamStudioApi'
import { GaBtn, GaCap, GaCard, TkBadge } from '@/components/ui-v2'
import { cn } from '@/lib/utils'
import { TeilPreview } from './TeilPreview'
import { Note, studioField, studioMiniBtn, type StudioStepProps } from './ui'

const EMPTY_TEXT: StudioText = { titleDe: '', vorspannDe: '', context: '', glossary: [] }

/** Bước 3 — Bài đọc: AI viết bài từ dữ kiện đã tích, sửa tay, viết lại đoạn bôi đen, bảng đo. */
export function StepText({ draft, locked, run, onNext }: StudioStepProps & { onNext: () => void }) {
  const t = useTranslations('v2.adminContent.examStudio')
  const [text, setText] = useState<StudioText>(draft.text ?? EMPTY_TEXT)
  const [dirty, setDirty] = useState(false)
  const [selection, setSelection] = useState('')
  const areaRef = useRef<HTMLTextAreaElement>(null)

  // Bản máy chủ đổi (AI viết xong, lưu xong) → nạp lại nếu người dùng không có sửa dở.
  const serverJson = JSON.stringify(draft.text)
  useEffect(() => {
    if (!dirty) setText(draft.text ?? EMPTY_TEXT)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverJson])

  const edit = (patch: Partial<StudioText>) => { setText((x) => ({ ...x, ...patch })); setDirty(true) }
  const editGloss = (i: number, patch: Partial<StudioText['glossary'][number]>) =>
    edit({ glossary: text.glossary.map((g, j) => (j === i ? { ...g, ...patch } : g)) })

  const readSelection = () => {
    const el = areaRef.current
    if (!el) return
    setSelection(el.value.slice(el.selectionStart, el.selectionEnd).trim())
  }

  const save = async () => {
    const cleaned: StudioText = { ...text, glossary: text.glossary.filter((g) => g.term.trim()) }
    if (await run(() => patchDraft(draft.id, { text: cleaned }), t('saved'))) setDirty(false)
  }
  const discard = () => { setText(draft.text ?? EMPTY_TEXT); setDirty(false) }
  const rewrite = async (mode: 'REWRITE' | 'SIMPLIFY') => {
    if (await run(() => writeText(draft.id, { selection, mode }))) setSelection('')
  }
  const writeAll = () => run(() => writeText(draft.id))

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-4">
        <GaCard className="flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <GaBtn variant="yellow" size="sm" disabled={locked || dirty} onClick={writeAll}>
              <Sparkles size={14} aria-hidden /> {draft.text ? t('text.rewriteAll') : t('text.write')}
            </GaBtn>
            {dirty && <span className="ga-ui text-ga-caption text-ga-muted">{t('text.saveFirst')}</span>}
          </div>

          {!draft.text && !dirty ? (
            <p className="ga-ui text-ga-small text-ga-muted">{t('text.empty')}</p>
          ) : (
            <>
              <div>
                <label htmlFor="text-title" className="mb-1.5 block"><GaCap>{t('text.titleDe')}</GaCap></label>
                <input id="text-title" lang="de" className={studioField} value={text.titleDe} disabled={locked}
                  onChange={(e) => edit({ titleDe: e.target.value })} />
              </div>
              <div>
                <label htmlFor="text-vorspann" className="mb-1.5 block"><GaCap>{t('text.vorspannDe')}</GaCap></label>
                <textarea id="text-vorspann" lang="de" rows={2} className={studioField} value={text.vorspannDe} disabled={locked}
                  onChange={(e) => edit({ vorspannDe: e.target.value })} />
              </div>
              <div>
                <label htmlFor="text-context" className="mb-1.5 block"><GaCap>{t('text.context')}</GaCap></label>
                <textarea
                  id="text-context"
                  ref={areaRef}
                  lang="de"
                  rows={16}
                  className={cn(studioField, 'whitespace-pre-wrap font-mono text-ga-small leading-relaxed')}
                  value={text.context}
                  disabled={locked}
                  onChange={(e) => edit({ context: e.target.value })}
                  onSelect={readSelection}
                  onKeyUp={readSelection}
                  onMouseUp={readSelection}
                  aria-describedby="text-context-hint"
                />
                <p id="text-context-hint" className="ga-ui mt-1 text-ga-caption text-ga-muted">{t('text.contextHint')}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={studioMiniBtn} disabled={locked || dirty || !selection}
                  onClick={() => rewrite('REWRITE')}>
                  <Wand2 size={13} aria-hidden /> {t('text.rewriteSel')}
                </button>
                <button type="button" className={studioMiniBtn} disabled={locked || dirty || !selection}
                  onClick={() => rewrite('SIMPLIFY')}>
                  <Wand2 size={13} aria-hidden /> {t('text.simplifySel')}
                </button>
                <span className="ga-ui text-ga-caption text-ga-muted">
                  {selection ? t('text.selected', { n: selection.split(/\s+/).length }) : t('text.selectHint')}
                </span>
              </div>

              <fieldset>
                <legend className="mb-1.5"><GaCap>{t('text.glossary')}</GaCap></legend>
                <div className="flex flex-col gap-2">
                  {text.glossary.map((g, i) => (
                    <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_minmax(0,1fr)_auto]">
                      <input lang="de" className={studioField} value={g.term} disabled={locked}
                        aria-label={t('text.glossTerm', { n: i + 1 })} placeholder={t('text.glossTermPh')}
                        onChange={(e) => editGloss(i, { term: e.target.value })} />
                      <input lang="de" className={studioField} value={g.explanationDe} disabled={locked}
                        aria-label={t('text.glossExpl', { n: i + 1 })} placeholder={t('text.glossExplPh')}
                        onChange={(e) => editGloss(i, { explanationDe: e.target.value })} />
                      <button type="button" className={studioMiniBtn} disabled={locked}
                        aria-label={t('text.glossRemove', { n: i + 1 })}
                        onClick={() => edit({ glossary: text.glossary.filter((_, j) => j !== i) })}>
                        <Trash2 size={13} aria-hidden />
                      </button>
                    </div>
                  ))}
                  <div>
                    <button type="button" className={studioMiniBtn} disabled={locked}
                      onClick={() => edit({ glossary: [...text.glossary, { term: '', explanationDe: '' }] })}>
                      <Plus size={13} aria-hidden /> {t('text.glossAdd')}
                    </button>
                  </div>
                </div>
              </fieldset>

              <div className="flex flex-wrap gap-2">
                <GaBtn variant="primary" size="sm" disabled={locked || !dirty} onClick={save}>
                  <Save size={14} aria-hidden /> {t('text.save')}
                </GaBtn>
                {dirty && <GaBtn variant="ghost" size="sm" onClick={discard}>{t('text.discard')}</GaBtn>}
              </div>
            </>
          )}
        </GaCard>

        {draft.text && (
          <section aria-labelledby="text-preview-h">
            <h3 id="text-preview-h" className="mb-2"><GaCap>{t('text.preview')}</GaCap></h3>
            <TeilPreview text={draft.text} items={[]} quelle={draft.quelle}
              highlightSnippets={draft.textMetrics?.overlapSnippets ?? []} />
          </section>
        )}

        <div>
          <GaBtn variant="primary" size="sm" disabled={!draft.text || dirty} onClick={onNext}>{t('next')}</GaBtn>
        </div>
      </div>

      <MetricsPanel draft={draft} />
    </div>
  )
}

function MetricsPanel({ draft }: { draft: StudioDraft }) {
  const t = useTranslations('v2.adminContent.examStudio')
  const m = draft.textMetrics
  const factById = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of draft.sources) for (const f of s.facts) map.set(f.id, f.text)
    return map
  }, [draft.sources])

  if (!m) {
    return (
      <aside className="h-fit rounded-ga border border-dashed border-ga-line p-4 text-ga-small text-ga-muted">
        {t('metrics.none')}
      </aside>
    )
  }
  const [lo, hi] = m.wordRange
  const wordsOk = m.wordCount >= lo && m.wordCount <= hi
  const levelOk = m.aboveLevelRatio <= m.maxAboveLevelRatio
  const overlapBad = m.overlapMaxRun >= m.overlapLimit
  const pct = (x: number) => `${Math.round(x * 1000) / 10}%`

  return (
    <aside aria-label={t('metrics.title')} className="flex h-fit flex-col gap-4 rounded-ga border border-ga-line bg-ga-card p-4 xl:sticky xl:top-4">
      <GaCap>{t('metrics.title')}</GaCap>

      <Metric label={t('metrics.words')} ok={wordsOk} value={t('metrics.wordsValue', { n: m.wordCount, lo, hi })} />

      <div className="flex flex-col gap-1.5">
        <Metric label={t('metrics.aboveLevel')} ok={levelOk}
          value={t('metrics.ratioValue', { v: pct(m.aboveLevelRatio), max: pct(m.maxAboveLevelRatio) })} warnTone="yellow" />
        {m.aboveLevelWords.length > 0 && (
          <div className="flex flex-wrap gap-1" lang="de">
            {m.aboveLevelWords.map((w) => <TkBadge key={w} tone={levelOk ? 'neutral' : 'yellow'}>{w}</TkBadge>)}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Metric label={t('metrics.overlap')} ok={!overlapBad}
          value={t('metrics.overlapValue', { n: m.overlapMaxRun, limit: m.overlapLimit })} />
        {overlapBad && m.overlapSnippets.length > 0 && (
          <ul className="flex flex-col gap-1" lang="de">
            {m.overlapSnippets.map((s, i) => (
              <li key={i} className="rounded-ga bg-ga-red-soft px-2 py-1 text-ga-caption text-ga-red">„{s}“</li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Metric label={t('metrics.unused')} ok={m.unusedFactIds.length === 0}
          value={String(m.unusedFactIds.length)} warnTone="yellow" />
        {m.unusedFactIds.length > 0 && (
          <ul className="flex list-disc flex-col gap-1 pl-4 text-ga-caption text-ga-muted" lang="de">
            {m.unusedFactIds.map((id) => <li key={id}>{factById.get(id) ?? id}</li>)}
          </ul>
        )}
      </div>
      {overlapBad && <Note tone="red">{t('metrics.overlapBlock')}</Note>}
    </aside>
  )
}

function Metric({ label, value, ok, warnTone = 'red' }: { label: string; value: string; ok: boolean; warnTone?: 'red' | 'yellow' }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="ga-ui text-ga-small text-ga-muted">{label}</span>
      <span className={cn('ga-ui text-ga-small font-semibold',
        ok ? 'text-ga-green' : warnTone === 'red' ? 'text-ga-red' : 'text-ga-gold')}>{value}</span>
    </div>
  )
}
