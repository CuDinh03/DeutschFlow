'use client'

import { useEffect, useMemo, useState, type SyntheticEvent } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Save, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { patchDraft, writeText, type StudioDraft, type StudioText } from '@/lib/adminExamStudioApi'
import { GaBtn, GaCap, GaCard, TkBadge } from '@/components/ui-v2'
import { cn } from '@/lib/utils'
import {
  A2_TEXT_WORD_RANGE, MATCH_TEXT_WORD_RANGE, NOTE_WORD_RANGE, adLettersFor, adWordRange, countWords, isGapKind, isHoerenKind, joinMatchTexts, matchTextInRange, splitMatchTexts, teilKind,
} from '@/lib/examStudioLogic'
import { HoerenEditor } from './HoerenParts'
import { TeilPreview } from './TeilPreview'
import { AdsEditor, EmailEditor, LetterEditor, NoteEditor, TitledTextEditor } from './TextEditors'
import { Note, studioField, studioMiniBtn, type StudioStepProps } from './ui'

const EMPTY_TEXT: StudioText = { titleDe: '', vorspannDe: '', context: '', glossary: [] }

/** Bước 3 — Bài đọc: AI viết bài từ dữ kiện đã tích, sửa tay, viết lại đoạn bôi đen, bảng đo. */
export function StepText({ draft, locked, run, onNext }: StudioStepProps & { onNext: () => void }) {
  const t = useTranslations('v2.adminContent.examStudio')
  const [text, setText] = useState<StudioText>(draft.text ?? EMPTY_TEXT)
  const [dirty, setDirty] = useState(false)
  const [selection, setSelection] = useState('')
  // Lesen T1: 5 văn bản ngắn sửa trong 5 ô riêng; lưu thì ghép lại bằng dòng trống.
  const kind = teilKind(draft.teilType)
  const match = kind === 'MATCH_HEADLINE'
  const article = kind === 'ARTICLE'
  const [texts, setTexts] = useState<string[]>(() => splitMatchTexts(draft.text?.context, draft.itemCount))

  // Bản máy chủ đổi (AI viết xong, lưu xong) → nạp lại nếu người dùng không có sửa dở.
  const serverJson = JSON.stringify(draft.text)
  useEffect(() => {
    if (!dirty) {
      setText(draft.text ?? EMPTY_TEXT)
      setTexts(splitMatchTexts(draft.text?.context, draft.itemCount))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverJson])

  const edit = (patch: Partial<StudioText>) => { setText((x) => ({ ...x, ...patch })); setDirty(true) }
  const editGloss = (i: number, patch: Partial<StudioText['glossary'][number]>) =>
    edit({ glossary: text.glossary.map((g, j) => (j === i ? { ...g, ...patch } : g)) })

  const editMatch = (i: number, value: string) => {
    setTexts((xs) => xs.map((x, j) => (j === i ? value : x)))
    setDirty(true)
  }

  /** Đoạn bôi đen trong ô đang thao tác (bài T2 hoặc một trong 5 ô T1). */
  const readSelection = (e: SyntheticEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    setSelection(el.value.slice(el.selectionStart, el.selectionEnd).trim())
  }

  const save = async () => {
    // Backend ghi đè nguyên `text` → luôn gửi cả object (giữ ads/examples/wordBank/stimulus… của dạng khác).
    const cleaned: StudioText = match
      ? { ...text, titleDe: '', vorspannDe: '', context: joinMatchTexts(texts), glossary: [] }
      : article
        ? { ...text, glossary: (text.glossary ?? []).filter((g) => g.term.trim()) }
        : { ...text }
    if (await run(() => patchDraft(draft.id, { text: cleaned }), t('saved'))) setDirty(false)
  }
  const discard = () => {
    setText(draft.text ?? EMPTY_TEXT)
    setTexts(splitMatchTexts(draft.text?.context, draft.itemCount))
    setDirty(false)
  }
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
            <p className="ga-ui text-ga-small text-ga-muted">{draft.needsSources === false ? t('text.emptySituation') : t('text.empty')}</p>
          ) : (
            <>
              {article && (<>
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
              </>)}
              {match ? (
                <MatchTextsEditor texts={texts} locked={locked} onChange={editMatch} onSelectText={readSelection} />
              ) : kind === 'MATCH_AD_X' ? (
                <AdsEditor text={text} locked={locked} edit={edit} onSelect={readSelection}
                  letters={adLettersFor(draft.cefrLevel)} range={adWordRange(draft.cefrLevel)} />
              ) : kind === 'GAP_MC' || kind === 'GAP_WORDBANK' ? (
                <LetterEditor text={text} locked={locked} edit={edit} onSelect={readSelection}
                  withAd={kind === 'GAP_WORDBANK'} hasItems={draft.items.length > 0} />
              ) : kind === 'HOEREN_STATEMENTS' || kind === 'HOEREN_INTERVIEW' || kind === 'HOEREN_ANNOUNCEMENTS' ? (
                <HoerenEditor kind={kind} text={text} locked={locked} edit={edit} onSelect={readSelection}
                  hasItems={draft.items.length > 0} />
              ) : kind === 'WRITE_EMAIL' ? (
                <EmailEditor text={text} locked={locked} edit={edit} onSelect={readSelection} />
              ) : kind === 'WRITE_NOTE' ? (
                <NoteEditor text={text} locked={locked} edit={edit} onSelect={readSelection} range={NOTE_WORD_RANGE} />
              ) : kind === 'MC_INFO' || kind === 'TRUE_FALSE' || kind === 'FILL_FORM' ? (
                <TitledTextEditor kind={kind} text={text} locked={locked} edit={edit} onSelect={readSelection}
                  range={A2_TEXT_WORD_RANGE[kind]} />
              ) : (
              <div>
                <label htmlFor="text-context" className="mb-1.5 block"><GaCap>{t('text.context')}</GaCap></label>
                <textarea
                  id="text-context"
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
              )}
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

              {article && (
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
              )}

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
            <TeilPreview text={draft.text} items={isGapKind(kind) || isHoerenKind(kind) ? draft.items : []} quelle={draft.quelle}
              showAnswers={false} layout={kind}
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

/** Lesen T1: 5 ô "Text 1…5", mỗi ô có số từ; tô vàng khi ngoài 55–110 từ. */
function MatchTextsEditor({
  texts, locked, onChange, onSelectText,
}: {
  texts: string[]
  locked: boolean
  onChange: (i: number, value: string) => void
  onSelectText: (e: SyntheticEvent<HTMLTextAreaElement>) => void
}) {
  const t = useTranslations('v2.adminContent.examStudio')
  const [lo, hi] = MATCH_TEXT_WORD_RANGE
  return (
    <div className="flex flex-col gap-3">
      <p className="ga-ui text-ga-caption text-ga-muted">{t('text.matchHint', { lo, hi })}</p>
      {texts.map((value, i) => {
        const n = countWords(value)
        const ok = matchTextInRange(value)
        const id = `match-text-${i + 1}`
        return (
          <div key={i}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <label htmlFor={id}><GaCap>{t('text.matchText', { n: i + 1 })}</GaCap></label>
              <span id={`${id}-count`} className={cn('ga-ui rounded-ga px-1.5 text-ga-caption font-semibold',
                ok ? 'text-ga-green' : 'bg-ga-yellow-soft text-ga-gold')}>
                {t('text.matchWords', { n, lo, hi })}
              </span>
            </div>
            <textarea
              id={id}
              lang="de"
              rows={5}
              className={cn(studioField, 'whitespace-pre-wrap font-mono text-ga-small leading-relaxed', !ok && 'border-ga-gold')}
              value={value}
              disabled={locked}
              aria-describedby={`${id}-count`}
              onChange={(e) => onChange(i, e.target.value)}
              onSelect={onSelectText}
              onKeyUp={onSelectText}
              onMouseUp={onSelectText}
            />
          </div>
        )
      })}
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
