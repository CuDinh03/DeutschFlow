'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Eye, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  assembleFromBlueprint, listAssemblySlots, listBlueprints,
  type AssembledExam, type AssemblyBlockOption, type AssemblySlotBlocks, type Blueprint,
} from '@/lib/adminExamStudioApi'
import {
  DIFFICULTY_ORDER, blockSelectable, blueprintRows, blueprintSelection, nextAssemblyNumber, slotKey,
} from '@/lib/examStudioLogic'
import { ErrorBanner, GaBtn, GaCap, GaCard, LoadingState, TkBadge } from '@/components/ui-v2'
import { BlockPreviewModal } from './BlockPreviewModal'
import { LevelBadges, slotLabel } from './AssembliesTab'
import { Note, studioField, studioMiniBtn } from './ui'

const bpKey = (bp: Blueprint) => `${bp.examFormat}-${bp.cefrLevel}`

/**
 * "Ghép từ khung" (đợt 4): cấp chưa có đề viết tay làm nền (telc A2 Đọc–Viết). MỌI ô Teil của khung phải chọn một
 * Teil kho cùng ô; Teil đã nằm trong bộ đề khác mặc định không chọn được (như ghép từ đề nền).
 */
export function BlueprintAssembleForm({ exams, onAssembled }: { exams: AssembledExam[]; onAssembled: () => Promise<void> }) {
  const t = useTranslations('v2.adminContent.examStudio')
  const [blueprints, setBlueprints] = useState<Blueprint[] | null>(null)
  const [error, setError] = useState('')
  const [key, setKey] = useState('')
  const [slots, setSlots] = useState<AssemblySlotBlocks[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [choices, setChoices] = useState<Record<string, number | null>>({})
  const [allowReuse, setAllowReuse] = useState(false)
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<number | null>(null)

  useEffect(() => {
    listBlueprints()
      .then((list) => { setBlueprints(list); if (list[0]) setKey(bpKey(list[0])) })
      .catch((e: unknown) => setError(apiMessage(e)))
  }, [])

  const bp = blueprints?.find((b) => bpKey(b) === key) ?? null

  // Teil kho của cấp của khung (A2 khác B1).
  useEffect(() => {
    if (!bp) return
    let alive = true
    setSlotsLoading(true)
    setChoices({})
    listAssemblySlots(bp.examFormat, bp.cefrLevel)
      .then((s) => { if (alive) setSlots(s) })
      .catch((e: unknown) => { if (alive) toast.error(apiMessage(e)) })
      .finally(() => { if (alive) setSlotsLoading(false) })
    return () => { alive = false }
  }, [bp])

  // Gợi ý tên theo khung + số bộ kế tiếp; đổi khung hoặc ghép xong thì gợi ý lại.
  const examCount = exams.length
  useEffect(() => {
    if (bp) setTitle(t('assembly.blueprintTitleSuggestion', { title: bp.title, n: nextAssemblyNumber(exams) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, examCount])

  const rows = useMemo(() => blueprintRows(bp, slots), [bp, slots])
  const { replacements, missing } = blueprintSelection(rows, choices, allowReuse)
  const ready = !!bp && rows.length > 0 && missing.length === 0 && title.trim() !== ''

  const submit = async () => {
    if (!bp || !ready) return
    setSaving(true)
    try {
      // 400 (thiếu ô) / 409 (Teil đã trong bộ khác, bộ y hệt đã có): câu lỗi tiếng Việt của backend → toast nguyên văn.
      await assembleFromBlueprint({
        examFormat: bp.examFormat, cefrLevel: bp.cefrLevel, title: title.trim(), replacements,
        ...(allowReuse ? { allowReuse: true } : {}),
      })
      toast.success(t('assembly.assembled'))
      setChoices({})
      await onAssembled()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const optionText = (b: AssemblyBlockOption) => [
    b.titleDe || t('blocks.previewTitle', { id: b.id }),
    b.theme,
    DIFFICULTY_ORDER.map((lv) => b.difficultyCounts?.[lv] ?? 0).join('-'),
    t('assembly.exposure', { n: b.exposureCount }),
    (b.usedIn ?? []).length > 0 ? t('assembly.usedIn', { list: b.usedIn.map((u) => u.title).join(', ') }) : null,
  ].filter(Boolean).join(' · ')

  return (
    <GaCard className="flex flex-col gap-4 p-4 sm:p-5">
      <div>
        <h2 className="ga-ui text-ga-h3 text-ga-ink">{t('assembly.blueprintTitle')}</h2>
        <p className="ga-ui text-ga-caption text-ga-muted">{t('assembly.blueprintHint')}</p>
      </div>

      {error ? (
        <ErrorBanner title={t('assembly.loadError')} message={error} />
      ) : !blueprints ? (
        <LoadingState variant="skeleton" rows={2} label={t('loading')} />
      ) : blueprints.length === 0 ? (
        <p className="ga-ui text-ga-small text-ga-muted">{t('assembly.noBlueprints')}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="bp-select" className="mb-1.5 block"><GaCap>{t('assembly.blueprintField')}</GaCap></label>
              <select id="bp-select" className={studioField} value={key} onChange={(e) => setKey(e.target.value)}>
                {blueprints.map((b) => <option key={bpKey(b)} value={bpKey(b)}>{b.title}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="bp-title" className="mb-1.5 block"><GaCap>{t('assembly.titleField')}</GaCap></label>
              <input id="bp-title" className={studioField} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
            </div>
          </div>
          {bp && (
            <p className="ga-ui text-ga-small text-ga-muted">
              {bp.descriptionVi} {t('assembly.blueprintStats', { points: bp.totalPoints, pass: bp.passPoints, minutes: bp.timeLimitMinutes })}
            </p>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5"><GaCap>{t('assembly.blueprintSlots')}</GaCap></legend>
            {slotsLoading && <LoadingState variant="skeleton" rows={3} label={t('loading')} />}
            {!slotsLoading && rows.map((r) => {
              const k = slotKey(r.section, r.teil)
              const id = `bp-slot-${k}`
              const value = choices[k] ?? null
              const chosen = r.blocks.find((b) => b.id === value) ?? null
              return (
                <div key={k} className="flex flex-col gap-2 rounded-ga border border-ga-line px-3 py-2.5">
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                    <label htmlFor={id} className="ga-ui w-36 shrink-0 text-ga-small font-semibold text-ga-ink">{slotLabel(r.section, r.teil)}</label>
                    <select id={id} className={studioField} value={value ?? ''} aria-required="true"
                      onChange={(e) => setChoices((c) => ({ ...c, [k]: e.target.value ? Number(e.target.value) : null }))}>
                      <option value="">{r.blocks.length ? t('assembly.pickBlock') : t('assembly.noBlockForSlot')}</option>
                      {r.blocks.map((b) => (
                        <option key={b.id} value={b.id} disabled={!blockSelectable(b, allowReuse)}>{optionText(b)}</option>
                      ))}
                    </select>
                    {chosen && (
                      <button type="button" className={studioMiniBtn} onClick={() => setPreview(chosen.id)}
                        aria-label={t('assembly.previewAria', { id: chosen.id })}>
                        <Eye size={13} aria-hidden /> {t('assembly.preview')}
                      </button>
                    )}
                  </div>
                  {r.blocks.length === 0 && <Note tone="red">{t('assembly.slotEmpty')}</Note>}
                  {chosen && (
                    <div className="ga-ui flex flex-wrap items-center gap-2 text-ga-caption text-ga-muted">
                      <LevelBadges counts={chosen.difficultyCounts} />
                      {chosen.theme && <span>{chosen.theme}</span>}
                      {(chosen.usedIn ?? []).length > 0 && (
                        <TkBadge tone="yellow">{t('assembly.usedIn', { list: chosen.usedIn.map((u) => u.title).join(', ') })}</TkBadge>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </fieldset>

          <label className="ga-ui flex items-start gap-2 text-ga-small text-ga-ink">
            <input type="checkbox" className="mt-1" checked={allowReuse} style={{ accentColor: 'var(--ga-accent)' }}
              onChange={(e) => setAllowReuse(e.target.checked)} />
            <span>
              {t('assembly.allowReuse')}
              <span className="block text-ga-caption text-ga-muted">{t('assembly.allowReuseHint')}</span>
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <GaBtn variant="yellow" size="sm" loading={saving} disabled={!ready} onClick={submit}>
              <Layers size={14} aria-hidden /> {t('assembly.assemble')}
            </GaBtn>
            <span className="ga-ui text-ga-caption text-ga-muted">
              {missing.length > 0
                ? t('assembly.blueprintMissing', { n: missing.length, total: rows.length })
                : !title.trim() ? t('assembly.error.NO_TITLE') : t('assembly.blueprintReady', { n: rows.length })}
            </span>
          </div>
        </>
      )}

      <BlockPreviewModal blockId={preview} onClose={() => setPreview(null)} />
    </GaCard>
  )
}
