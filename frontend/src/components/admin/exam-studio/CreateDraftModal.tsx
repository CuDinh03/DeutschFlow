'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { createDraft, DIFFICULTY_PRESETS, type DifficultyPlan, type StudioDraft } from '@/lib/adminExamStudioApi'
import { STUDIO_TEIL_ITEM_COUNT, checkMatrix } from '@/lib/examStudioLogic'
import { GaBtn, GaCap, TkModal } from '@/components/ui-v2'
import { DifficultyMatrix } from './DifficultyMatrix'
import { ModeSelect, ThemeSelect } from './FrameFields'
import { studioField } from './ui'

/** Phần / Teil hiện trong form; Đợt 1 chỉ mở LESEN · Teil 2, còn lại khoá "Đợt sau". */
const SECTIONS = [
  { value: 'LESEN', enabled: true },
  { value: 'SPRACHBAUSTEINE', enabled: false },
  { value: 'HOEREN', enabled: false },
  { value: 'SCHREIBEN', enabled: false },
] as const
const TEILS = [1, 2, 3, 4, 5]

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
  const [plan, setPlan] = useState<DifficultyPlan>({ ...DIFFICULTY_PRESETS[0].plan })
  const [saving, setSaving] = useState(false)
  const check = checkMatrix(plan, mode, STUDIO_TEIL_ITEM_COUNT)

  const submit = async () => {
    if (!check.valid) return
    setSaving(true)
    try {
      const d = await createDraft({
        examFormat: 'TELC', cefrLevel: 'B1', section: 'LESEN', teil: 2,
        theme: theme || null, mode, difficultyPlan: plan,
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
          <GaBtn variant="yellow" size="sm" loading={saving} disabled={!check.valid} onClick={submit}>
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
            <select id="create-section" className={studioField} value="LESEN" onChange={() => undefined}>
              {SECTIONS.map((s) => (
                <option key={s.value} value={s.value} disabled={!s.enabled}>
                  {t(`section.${s.value}`)}{s.enabled ? '' : ` — ${t('later')}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="create-teil" className="mb-1.5 block"><GaCap>{t('frame.teil')}</GaCap></label>
            <select id="create-teil" className={studioField} value="2" onChange={() => undefined}>
              {TEILS.map((n) => (
                <option key={n} value={String(n)} disabled={n !== 2}>
                  Teil {n}{n === 2 ? '' : ` — ${t('later')}`}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="ga-ui text-ga-caption text-ga-muted">{t('frame.blueprintHint', { itemCount: STUDIO_TEIL_ITEM_COUNT })}</p>

        <ThemeSelect id="create-theme" value={theme} onChange={setTheme} />
        <ModeSelect value={mode} onChange={setMode} />

        <div>
          <GaCap className="mb-2 block">{t('frame.matrix')}</GaCap>
          <DifficultyMatrix plan={plan} onChange={setPlan} mode={mode} itemCount={STUDIO_TEIL_ITEM_COUNT} />
        </div>
      </div>
    </TkModal>
  )
}
