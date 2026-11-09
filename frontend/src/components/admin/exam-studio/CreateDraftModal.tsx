'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { createDraft, DIFFICULTY_PRESETS, type DifficultyPlan, type StudioDraft } from '@/lib/adminExamStudioApi'
import { catalogEntry, checkMatrix, scalePlan, teilKind } from '@/lib/examStudioLogic'
import { GaBtn, GaCap, TkModal } from '@/components/ui-v2'
import { DifficultyMatrix } from './DifficultyMatrix'
import { ModeSelect, ThemeSelect } from './FrameFields'
import { studioField } from './ui'

/** Số Teil của từng phần thi telc B1; Teil có trong STUDIO_TEIL_CATALOG mới chọn được, còn lại "Đợt sau". */
const SECTION_TEILS: Record<string, number[]> = {
  LESEN: [1, 2, 3],
  SPRACHBAUSTEINE: [1, 2],
  HOEREN: [1, 2, 3],
  SCHREIBEN: [1],
}
const SECTIONS = Object.keys(SECTION_TEILS)
const sectionEnabled = (sec: string) => SECTION_TEILS[sec].some((n) => catalogEntry(sec, n) != null)
const realPlan = (itemCount: number) => scalePlan(DIFFICULTY_PRESETS[0].plan, itemCount)

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (draft: StudioDraft) => void
}

export function CreateDraftModal({ open, onOpenChange, onCreated }: Props) {
  const t = useTranslations('v2.adminContent.examStudio')
  const tc = useTranslations('v2.common')
  const [theme, setTheme] = useState<string>('')
  const [mode, setMode] = useState<'EXAM' | 'PRACTICE'>('EXAM')
  const [section, setSection] = useState('LESEN')
  const [teil, setTeil] = useState(2)
  const [plan, setPlan] = useState<DifficultyPlan>(() => realPlan(5))
  const [situation, setSituation] = useState('')
  const [saving, setSaving] = useState(false)
  const entry = catalogEntry(section, teil)
  const itemCount = entry?.itemCount ?? 0
  const kind = teilKind(entry?.teilType)
  const check = checkMatrix(plan, mode, itemCount)

  /** Đổi phần/Teil: nhảy về Teil đầu tiên mở được và đặt lại ma trận theo số câu của Teil mới. */
  const pick = (sec: string, n?: number) => {
    const teilNo = n ?? SECTION_TEILS[sec].find((x) => catalogEntry(sec, x) != null) ?? 1
    setSection(sec)
    setTeil(teilNo)
    setPlan(realPlan(catalogEntry(sec, teilNo)?.itemCount ?? 0))
  }

  const submit = async () => {
    if (!check.valid || !entry) return
    setSaving(true)
    try {
      const d = await createDraft({
        examFormat: 'TELC', cefrLevel: 'B1', section, teil,
        theme: theme || null, mode,
        // Schreiben không có ma trận độ khó: gửi toàn 0.
        difficultyPlan: itemCount === 0 ? { EASY: 0, MEDIUM: 0, HARD: 0, EXPERT: 0 } : plan,
        ...(entry.needsSources ? {} : { situation: situation.trim() || null }),
      })
      toast.success(t('create.created'))
      onCreated(d)
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <TkModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('create.title')}
      description={t('create.subtitle')}
      size="md"
      footer={
        <>
          <GaBtn variant="ghost" size="sm" onClick={() => onOpenChange(false)}>{tc('cancel')}</GaBtn>
          <GaBtn variant="yellow" size="sm" loading={saving} disabled={!check.valid || !entry} onClick={submit}>
            {t('create.submit')}
          </GaBtn>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <GaCap className="mb-1.5 block">{t('frame.exam')}</GaCap>
            <select className={studioField} value="TELC" disabled aria-label={t('frame.exam')}>
              <option value="TELC">telc</option>
            </select>
          </div>
          <div>
            <GaCap className="mb-1.5 block">{t('frame.level')}</GaCap>
            <select className={studioField} value="B1" disabled aria-label={t('frame.level')}>
              <option value="B1">B1</option>
            </select>
          </div>
          <div>
            <label htmlFor="create-section" className="mb-1.5 block"><GaCap>{t('frame.section')}</GaCap></label>
            <select id="create-section" className={studioField} value={section} onChange={(e) => pick(e.target.value)}>
              {SECTIONS.map((sec) => (
                <option key={sec} value={sec} disabled={!sectionEnabled(sec)}>
                  {t(`section.${sec}`)}{sectionEnabled(sec) ? '' : ` — ${t('later')}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="create-teil" className="mb-1.5 block"><GaCap>{t('frame.teil')}</GaCap></label>
            <select id="create-teil" className={studioField} value={String(teil)}
              onChange={(e) => pick(section, Number(e.target.value))}>
              {SECTION_TEILS[section].map((n) => {
                const ok = catalogEntry(section, n) != null
                return (
                  <option key={n} value={String(n)} disabled={!ok}>
                    Teil {n}{ok ? '' : ` — ${t('later')}`}
                  </option>
                )
              })}
            </select>
          </div>
        </div>
        <p className="ga-ui text-ga-caption text-ga-muted">{t(`frame.blueprintKind.${kind}`, { itemCount })}</p>

        <ThemeSelect id="create-theme" value={theme} onChange={setTheme} />
        {entry && !entry.needsSources && (
          <div>
            <label htmlFor="create-situation" className="mb-1.5 block"><GaCap>{t('situation.label')}</GaCap></label>
            <textarea id="create-situation" rows={2} className={studioField} value={situation} maxLength={1000}
              placeholder={t(`situation.placeholder.${kind}`)} onChange={(e) => setSituation(e.target.value)} />
            <p className="ga-ui mt-1 text-ga-caption text-ga-muted">{t('situation.hint')}</p>
          </div>
        )}
        <ModeSelect value={mode} onChange={setMode} />

        {itemCount > 0 && (
          <div>
            <GaCap className="mb-2 block">{t('frame.matrix')}</GaCap>
            <DifficultyMatrix plan={plan} onChange={setPlan} mode={mode} itemCount={itemCount} />
          </div>
        )}
      </div>
    </TkModal>
  )
}
