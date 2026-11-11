'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, ExternalLink, Plus, Trash2 } from 'lucide-react'
import {
  addSource, patchSource, removeSource,
  type StudioSource,
} from '@/lib/adminExamStudioApi'
import { flaggedSelectedSources, selectedFactCount, selectedFactIds } from '@/lib/examStudioLogic'
import { ConfirmDialog, GaBtn, GaCap, GaCard, TkBadge, TkSeg } from '@/components/ui-v2'
import { cn } from '@/lib/utils'
import { Note, WarningsBanner, studioField, studioMiniBtn, type StudioStepProps } from './ui'

type InputKind = 'URL' | 'PASTE'

/** Bước 2 — Nguồn: thêm URL / dán văn bản, xác nhận loại dùng, kiểm trung lập, tích dữ kiện. */
export function StepSource({ draft, locked, run, onNext }: StudioStepProps & { onNext: () => void }) {
  const t = useTranslations('v2.adminContent.examStudio')
  const [showForm, setShowForm] = useState(draft.sources.length === 0)
  const [kind, setKind] = useState<InputKind>('URL')
  const [url, setUrl] = useState('')
  const [pasted, setPasted] = useState('')
  const [title, setTitle] = useState('')
  const [publisher, setPublisher] = useState('')
  const [removing, setRemoving] = useState<StudioSource | null>(null)

  const flagged = flaggedSelectedSources(draft.sources)
  const selected = selectedFactCount(draft.sources)
  const canAdd = kind === 'URL' ? /^https?:\/\/\S+$/i.test(url.trim()) : pasted.trim().length > 0

  const submit = async () => {
    const ok = await run(() =>
      addSource(draft.id, {
        ...(kind === 'URL' ? { url: url.trim() } : { pastedText: pasted }),
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(publisher.trim() ? { publisher: publisher.trim() } : {}),
      }),
    )
    if (ok) {
      setUrl(''); setPasted(''); setTitle(''); setPublisher(''); setShowForm(false)
    }
  }

  const toggleFact = (src: StudioSource, factId: string) => {
    const cur = selectedFactIds(src)
    const next = cur.includes(factId) ? cur.filter((x) => x !== factId) : [...cur, factId]
    void run(() => patchSource(draft.id, src.id, { selectedFactIds: next }))
  }

  return (
    <div className="flex flex-col gap-4">
      <WarningsBanner warnings={draft.warnings} />
      {draft.sources.map((src) => (
        <SourceCard
          key={src.id}
          src={src}
          locked={locked}
          onUsage={(m) => run(() => patchSource(draft.id, src.id, { usageMode: m }))}
          onToggleFact={(fid) => toggleFact(src, fid)}
          onRemove={() => setRemoving(src)}
        />
      ))}

      {showForm ? (
        <GaCard className="flex flex-col gap-3 p-4 sm:p-5">
          <h3 className="ga-ui text-ga-h3 text-ga-ink">
            {draft.sources.length === 0 ? t('source.addTitle') : t('source.addSecond')}
          </h3>
          <TkSeg
            aria-label={t('source.kind')}
            value={kind}
            onValueChange={setKind}
            options={[
              { value: 'URL', label: t('source.kindUrl') },
              { value: 'PASTE', label: t('source.kindPaste') },
            ]}
          />
          {kind === 'URL' ? (
            <div>
              <label htmlFor="src-url" className="mb-1.5 block"><GaCap>{t('source.url')}</GaCap></label>
              <input id="src-url" type="url" inputMode="url" className={studioField} value={url}
                placeholder="https://" onChange={(e) => setUrl(e.target.value)} disabled={locked} />
            </div>
          ) : (
            <div>
              <label htmlFor="src-paste" className="mb-1.5 block"><GaCap>{t('source.paste')}</GaCap></label>
              <textarea id="src-paste" rows={8} className={cn(studioField, 'font-mono text-ga-small')} value={pasted}
                onChange={(e) => setPasted(e.target.value)} disabled={locked} />
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="src-title" className="mb-1.5 block"><GaCap>{t('source.titleOptional')}</GaCap></label>
              <input id="src-title" className={studioField} value={title} onChange={(e) => setTitle(e.target.value)} disabled={locked} />
            </div>
            <div>
              <label htmlFor="src-pub" className="mb-1.5 block"><GaCap>{t('source.publisherOptional')}</GaCap></label>
              <input id="src-pub" className={studioField} value={publisher} onChange={(e) => setPublisher(e.target.value)} disabled={locked} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <GaBtn variant="yellow" size="sm" disabled={locked || !canAdd} onClick={submit}>
              <Plus size={14} aria-hidden /> {t('source.submit')}
            </GaBtn>
            {draft.sources.length > 0 && (
              <GaBtn variant="ghost" size="sm" onClick={() => setShowForm(false)}>{t('cancel')}</GaBtn>
            )}
          </div>
        </GaCard>
      ) : (
        <div>
          <GaBtn variant="ghost" size="sm" disabled={locked} onClick={() => setShowForm(true)}>
            <Plus size={14} aria-hidden /> {t('source.addSecond')}
          </GaBtn>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-ga-line pt-4">
        {flagged.length > 0 && <Note tone="red">{t('source.flaggedBlock')}</Note>}
        {selected === 0 && draft.sources.length > 0 && <Note tone="yellow">{t('source.needFact')}</Note>}
        <div className="flex flex-wrap items-center gap-3">
          <GaBtn variant="primary" size="sm" disabled={selected === 0 || flagged.length > 0} onClick={onNext}>
            {t('next')}
          </GaBtn>
          <span className="ga-ui text-ga-caption text-ga-muted">{t('source.selectedCount', { n: selected })}</span>
        </div>
      </div>

      <ConfirmDialog
        open={removing != null}
        onOpenChange={(o) => { if (!o) setRemoving(null) }}
        title={t('source.removeTitle')}
        description={removing?.title || removing?.url || ''}
        confirmLabel={t('source.remove')}
        cancelLabel={t('cancel')}
        onConfirm={() => {
          const s = removing
          setRemoving(null)
          if (s) void run(() => removeSource(draft.id, s.id))
        }}
      />
    </div>
  )
}

function SourceCard({
  src, locked, onUsage, onToggleFact, onRemove,
}: {
  src: StudioSource
  locked: boolean
  onUsage: (m: 'ADAPT' | 'FACTS_ONLY') => void
  onToggleFact: (factId: string) => void
  onRemove: () => void
}) {
  const t = useTranslations('v2.adminContent.examStudio')
  const meta = [src.publisher, src.author, src.publishedAt].filter(Boolean).join(' · ')
  const other = src.usageMode === 'ADAPT' ? 'FACTS_ONLY' : 'ADAPT'

  return (
    <GaCard className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="ga-ui break-words text-ga-h3 text-ga-ink">{src.title || src.url || t('source.untitled')}</h3>
          {meta && <p className="ga-ui text-ga-caption text-ga-muted">{meta}</p>}
          {src.url && (
            <a href={src.url} target="_blank" rel="noopener noreferrer"
              className="ga-ui inline-flex max-w-full items-center gap-1 break-all text-ga-caption text-ga-accent underline">
              <span className="min-w-0 truncate">{src.url}</span> <ExternalLink size={12} aria-hidden />
            </a>
          )}
        </div>
        <button type="button" className={studioMiniBtn} disabled={locked} onClick={onRemove}
          aria-label={t('source.removeAria', { title: src.title || src.url || '' })}>
          <Trash2 size={13} aria-hidden /> {t('source.remove')}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TkBadge tone={src.usageMode === 'ADAPT' ? 'teal' : 'navy'}>{t(`usage.${src.usageMode}`)}</TkBadge>
        {src.usageModeConfirmed
          ? <TkBadge tone="green"><Check size={11} aria-hidden /> {t('source.usageConfirmed')}</TkBadge>
          : <TkBadge tone="yellow">{t('source.usageGuess')}</TkBadge>}
        {!src.usageModeConfirmed && (
          <button type="button" className={studioMiniBtn} disabled={locked} onClick={() => onUsage(src.usageMode)}>
            <Check size={13} aria-hidden /> {t('source.confirmUsage')}
          </button>
        )}
        <button type="button" className={studioMiniBtn} disabled={locked} onClick={() => onUsage(other)}>
          {t('source.switchUsage', { mode: t(`usage.${other}`) })}
        </button>
        {src.neutrality === 'OK'
          ? <TkBadge tone="green">{t('source.neutralOk')}</TkBadge>
          : <TkBadge tone="red" variant="solid">{t('source.neutralFlagged')}</TkBadge>}
      </div>

      {src.neutrality === 'FLAGGED' && src.neutralityReason && (
        <Note tone="red">{src.neutralityReason}</Note>
      )}

      <div>
        <GaCap className="mb-1 block">{t('source.license')}</GaCap>
        <p className="ga-ui break-words text-ga-small text-ga-ink">{src.licenseText || t('source.licenseNone')}</p>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5"><GaCap>{t('source.facts', { n: src.facts.length })}</GaCap></legend>
        {src.facts.length === 0 && <p className="ga-ui text-ga-small text-ga-muted">{t('source.noFacts')}</p>}
        {src.facts.map((f) => (
          <label key={f.id}
            className={cn('flex cursor-pointer items-start gap-2.5 rounded-ga border px-3 py-2',
              f.selected ? 'border-ga-accent bg-ga-surface' : 'border-ga-line bg-ga-card')}>
            <input type="checkbox" className="mt-1 shrink-0" checked={f.selected} disabled={locked}
              onChange={() => onToggleFact(f.id)} style={{ accentColor: 'var(--ga-accent)' }} />
            <span className="min-w-0 flex-1">
              <span className="block text-ga-body text-ga-ink" lang="de">{f.text}</span>
              <span className="ga-ui mt-1 flex flex-wrap items-center gap-1.5 text-ga-caption text-ga-muted">
                {f.figure && <span>{t('source.figure', { v: f.figure })}</span>}
                {f.year && <span>{t('source.year', { v: f.year })}</span>}
                {f.paragraph != null && <span>{t('source.paragraph', { n: f.paragraph })}</span>}
                {f.corroborated && <TkBadge tone="green">{t('source.corroborated')}</TkBadge>}
                {!f.corroborated && src.usageMode === 'FACTS_ONLY' && (
                  <TkBadge tone="yellow">{t('source.noSecond')}</TkBadge>
                )}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
    </GaCard>
  )
}
