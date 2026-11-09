'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Eye, EyeOff, ExternalLink, Layers, Send } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  DIFFICULTY_LABEL,
  assembleExam, listAssembledExams, listAssemblyBases, listAssemblySlots,
  publishAssembledExam, retireAssembledExam,
  type AssembledExam, type AssemblyBase, type AssemblyBlockOption, type AssemblySlotBlocks,
} from '@/lib/adminExamStudioApi'
import {
  DIFFICULTY_ORDER,
  assembledStatus, assemblyFormErrors, assemblyReplacements, assemblyRows, nextAssemblyNumber, slotKey,
  type AssemblyRow,
} from '@/lib/examStudioLogic'
import {
  ConfirmDialog, EmptyState, ErrorBanner, GaBtn, GaCap, GaCard, LoadingState, TkBadge,
} from '@/components/ui-v2'
import { BlockPreviewModal } from './BlockPreviewModal'
import { Note, studioField, studioMiniBtn } from './ui'

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

/**
 * Tên phần thi telc giữ nguyên tiếng Đức ở mọi ngôn ngữ (nhãn đề thật, như "Lesen T2"), nên không đi qua
 * catalog — catalogLanguagePurity sẽ coi là bản dịch bị quên.
 */
const TELC_SECTION_SHORT: Record<string, string> = {
  LESEN: 'Lesen', SPRACHBAUSTEINE: 'Sprachbausteine', HOEREN: 'Hören', SCHREIBEN: 'Schreiben',
}

function slotLabel(section: string, teil: number): string {
  return `${TELC_SECTION_SHORT[section.toUpperCase()] ?? section} T${teil}`
}

function LevelBadges({ counts }: { counts: AssemblyBlockOption['difficultyCounts'] }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {DIFFICULTY_ORDER.map((lv) => (
        <TkBadge key={lv} tone={counts?.[lv] ? 'navy' : 'neutral'}>
          {DIFFICULTY_LABEL[lv]} {counts?.[lv] ?? 0}
        </TkBadge>
      ))}
    </span>
  )
}

type Pending = { kind: 'publish' | 'retire'; exam: AssembledExam } | null

/** Tab "Bộ đề": ghép đề mới từ đề nền + Teil trong kho, rồi phát hành / gỡ. */
export function AssembliesTab({ active }: { active: boolean }) {
  const t = useTranslations('v2.adminContent.examStudio')
  const [bases, setBases] = useState<AssemblyBase[] | null>(null)
  const [slots, setSlots] = useState<AssemblySlotBlocks[]>([])
  const [exams, setExams] = useState<AssembledExam[] | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<Pending>(null)
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    try {
      const [b, s, e] = await Promise.all([listAssemblyBases(), listAssemblySlots(), listAssembledExams()])
      setBases(b); setSlots(s); setExams(e); setError('')
    } catch (err: unknown) {
      setError(apiMessage(err))
    }
  }, [])
  useEffect(() => { if (active) void load() }, [active, load])

  const baseTitle = useMemo(() => new Map((bases ?? []).map((b) => [b.id, b.title])), [bases])

  const confirm = async () => {
    if (!pending) return
    setActing(true)
    try {
      if (pending.kind === 'publish') {
        await publishAssembledExam(pending.exam.id)
        toast.success(t('assembly.published'))
      } else {
        await retireAssembledExam(pending.exam.id)
        toast.success(t('assembly.retired'))
      }
      setPending(null)
      setExams(await listAssembledExams())
    } catch (err: unknown) {
      toast.error(apiMessage(err))
    } finally {
      setActing(false)
    }
  }

  if (error) return <ErrorBanner title={t('assembly.loadError')} message={error} onRetry={load} />
  if (!bases || !exams) return <LoadingState variant="skeleton" rows={4} label={t('loading')} />

  return (
    <div className="flex flex-col gap-6">
      <AssembleForm bases={bases} slots={slots} exams={exams} onAssembled={load} />

      <section aria-labelledby="assembled-h" className="flex flex-col gap-2">
        <h2 id="assembled-h"><GaCap>{t('assembly.listTitle')}</GaCap></h2>
        {exams.length === 0 ? (
          <EmptyState icon={Layers} title={t('assembly.empty')} description={t('assembly.emptyHint')} />
        ) : (
          <ul className="flex flex-col divide-y divide-ga-line rounded-ga border border-ga-line bg-ga-card">
            {exams.map((e) => {
              const st = assembledStatus(e)
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1 basis-64">
                    <p className="ga-ui truncate text-ga-body font-semibold text-ga-ink">{e.title}</p>
                    <p className="ga-ui text-ga-caption text-ga-muted">
                      {t('assembly.base', {
                        title: e.baseExamId != null ? (baseTitle.get(e.baseExamId) ?? `#${e.baseExamId}`) : '—',
                      })}
                      {e.createdAt ? ` · ${fmtDate(e.createdAt)}` : ''}
                    </p>
                    {e.teile.length > 0 && (
                      <p className="ga-ui text-ga-caption text-ga-muted">
                        {e.teile.map((x) => t('assembly.replaced', { slot: slotLabel(x.section, x.teil), id: x.blockId })).join(' · ')}
                      </p>
                    )}
                  </div>
                  <TkBadge tone={st === 'PUBLISHED' ? 'green' : st === 'UPCOMING' ? 'yellow' : 'neutral'}>
                    {t(`assembly.status.${st}`)}
                  </TkBadge>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <a href={`/v2/student/mock-exam/practice?examId=${e.id}`} target="_blank" rel="noopener noreferrer"
                      className={studioMiniBtn}>
                      <ExternalLink size={13} aria-hidden /> {t('assembly.viewAsStudent')}
                    </a>
                    {st !== 'PUBLISHED' && (
                      <button type="button" className={studioMiniBtn} onClick={() => setPending({ kind: 'publish', exam: e })}>
                        <Send size={13} aria-hidden /> {t('assembly.publish')}
                      </button>
                    )}
                    {st !== 'RETIRED' && (
                      <button type="button" className={studioMiniBtn} onClick={() => setPending({ kind: 'retire', exam: e })}>
                        <EyeOff size={13} aria-hidden /> {t('assembly.retire')}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={pending != null}
        onOpenChange={(o) => { if (!o) setPending(null) }}
        tone={pending?.kind === 'publish' ? 'caution' : 'danger'}
        title={pending?.kind === 'publish' ? t('assembly.publishTitle') : t('assembly.retireTitle')}
        description={pending
          ? t(pending.kind === 'publish' ? 'assembly.publishBody' : 'assembly.retireBody', { title: pending.exam.title })
          : undefined}
        confirmLabel={pending?.kind === 'publish' ? t('assembly.publish') : t('assembly.retire')}
        cancelLabel={t('cancel')}
        loading={acting}
        onConfirm={confirm}
      />
    </div>
  )
}

function AssembleForm({
  bases, slots, exams, onAssembled,
}: {
  bases: AssemblyBase[]
  slots: AssemblySlotBlocks[]
  exams: AssembledExam[]
  onAssembled: () => Promise<void>
}) {
  const t = useTranslations('v2.adminContent.examStudio')
  const [baseId, setBaseId] = useState<number | null>(bases[0]?.id ?? null)
  const [title, setTitle] = useState(() => t('assembly.titleSuggestion', { n: nextAssemblyNumber(exams) }))
  const [choices, setChoices] = useState<Record<string, number | null>>({})
  const [preview, setPreview] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  // Ghép xong (số bộ đổi) → gợi ý lại tên cho bộ kế tiếp.
  const examCount = exams.length
  useEffect(() => {
    setTitle(t('assembly.titleSuggestion', { n: nextAssemblyNumber(exams) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examCount])

  const base = bases.find((b) => b.id === baseId) ?? null
  const rows = useMemo(() => assemblyRows(base, slots), [base, slots])
  const replacements = assemblyReplacements(rows, choices)
  const errors = assemblyFormErrors({ baseExamId: baseId, title, replacements })

  const submit = async () => {
    if (errors.length > 0 || baseId == null) return
    setSaving(true)
    try {
      await assembleExam({ baseExamId: baseId, title: title.trim(), replacements })
      toast.success(t('assembly.assembled'))
      setChoices({})
      await onAssembled()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <GaCard className="flex flex-col gap-4 p-4 sm:p-5">
      <h2 className="ga-ui text-ga-h3 text-ga-ink">{t('assembly.formTitle')}</h2>

      {bases.length === 0 ? (
        <p className="ga-ui text-ga-small text-ga-muted">{t('assembly.noBases')}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="asm-base" className="mb-1.5 block"><GaCap>{t('assembly.baseField')}</GaCap></label>
              <select id="asm-base" className={studioField} value={baseId ?? ''}
                onChange={(e) => { setBaseId(e.target.value ? Number(e.target.value) : null); setChoices({}) }}>
                {bases.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}{b.reviewed ? '' : ` (${t('assembly.status.UPCOMING')})`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="asm-title" className="mb-1.5 block"><GaCap>{t('assembly.titleField')}</GaCap></label>
              <input id="asm-title" className={studioField} value={title} maxLength={200}
                onChange={(e) => setTitle(e.target.value)} />
            </div>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5"><GaCap>{t('assembly.slotsLegend')}</GaCap></legend>
            {rows.length === 0 && <p className="ga-ui text-ga-small text-ga-muted">{t('assembly.noSlots')}</p>}
            {rows.map((r) => (
              <SlotRow
                key={slotKey(r.slot.section, r.slot.teil)}
                row={r}
                label={slotLabel(r.slot.section, r.slot.teil)}
                value={choices[slotKey(r.slot.section, r.slot.teil)] ?? null}
                onChange={(v) => setChoices((c) => ({ ...c, [slotKey(r.slot.section, r.slot.teil)]: v }))}
                onPreview={setPreview}
              />
            ))}
          </fieldset>

          <Note tone="yellow">{t('assembly.reuseWarning')}</Note>

          <div className="flex flex-wrap items-center gap-3">
            <GaBtn variant="yellow" size="sm" loading={saving} disabled={errors.length > 0} onClick={submit}>
              <Layers size={14} aria-hidden /> {t('assembly.assemble')}
            </GaBtn>
            <span className="ga-ui text-ga-caption text-ga-muted">
              {errors.includes('NO_TITLE')
                ? t('assembly.error.NO_TITLE')
                : errors.includes('NO_REPLACEMENT')
                  ? t('assembly.error.NO_REPLACEMENT')
                  : t('assembly.replacingCount', { n: replacements.length })}
            </span>
          </div>
        </>
      )}

      <BlockPreviewModal blockId={preview} onClose={() => setPreview(null)} />
    </GaCard>
  )
}

function SlotRow({
  row, label, value, onChange, onPreview,
}: {
  row: AssemblyRow
  label: string
  value: number | null
  onChange: (v: number | null) => void
  onPreview: (blockId: number) => void
}) {
  const t = useTranslations('v2.adminContent.examStudio')
  const id = `asm-slot-${slotKey(row.slot.section, row.slot.teil)}`
  const locked = row.status !== 'OK'
  const chosen = row.slot.blocks.find((b) => b.id === value) ?? null
  const optionText = (b: AssemblyBlockOption) =>
    [
      b.titleDe || t('blocks.previewTitle', { id: b.id }),
      b.theme,
      DIFFICULTY_ORDER.map((lv) => b.difficultyCounts?.[lv] ?? 0).join('-'),
      t('assembly.exposure', { n: b.exposureCount }),
    ].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-col gap-2 rounded-ga border border-ga-line px-3 py-2.5">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
        <label htmlFor={id} className="ga-ui w-28 shrink-0 text-ga-small font-semibold text-ga-ink">{label}</label>
        <select id={id} className={studioField} disabled={locked} value={value ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
          <option value="">{t('assembly.keepBase')}</option>
          {row.slot.blocks.map((b) => <option key={b.id} value={b.id}>{optionText(b)}</option>)}
        </select>
        {chosen && (
          <button type="button" className={studioMiniBtn} onClick={() => onPreview(chosen.id)}
            aria-label={t('assembly.previewAria', { id: chosen.id })}>
            <Eye size={13} aria-hidden /> {t('assembly.preview')}
          </button>
        )}
      </div>
      {locked && (
        <Note tone="red">
          {t('assembly.typeMismatch', { base: row.baseType ?? '—', bank: row.slot.type })}
        </Note>
      )}
      {chosen && (
        <div className="ga-ui flex flex-wrap items-center gap-2 text-ga-caption text-ga-muted sm:pl-[7.5rem]">
          <LevelBadges counts={chosen.difficultyCounts} />
          {chosen.theme && <span>{chosen.theme}</span>}
          <span>{t('assembly.exposure', { n: chosen.exposureCount })}</span>
        </div>
      )}
    </div>
  )
}
