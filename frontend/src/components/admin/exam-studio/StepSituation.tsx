'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Save } from 'lucide-react'
import { patchDraft } from '@/lib/adminExamStudioApi'
import { teilKind } from '@/lib/examStudioLogic'
import { GaBtn, GaCard } from '@/components/ui-v2'
import { WarningsBanner, studioField, type StudioStepProps } from './ui'

/**
 * Bước 2 cho Teil soạn theo tình huống (needsSources = false: Lesen T3, Sprachbausteine, Schreiben): một ô
 * "Tình huống", không có nguồn/dữ kiện/giấy phép. Để trống thì AI tự chọn, nên luôn sang bước sau được.
 */
export function StepSituation({ draft, locked, run, onNext }: StudioStepProps & { onNext: () => void }) {
  const t = useTranslations('v2.adminContent.examStudio')
  const [value, setValue] = useState(draft.situation ?? '')
  const dirty = value.trim() !== (draft.situation ?? '').trim()

  useEffect(() => { setValue(draft.situation ?? '') }, [draft.situation])

  const save = () => run(() => patchDraft(draft.id, { situation: value.trim() || null }), t('saved'))

  return (
    <div className="flex flex-col gap-4">
      <WarningsBanner warnings={draft.warnings} />
      <GaCard className="flex flex-col gap-3 p-4 sm:p-5">
        <label htmlFor="situation" className="ga-ui text-ga-h3 text-ga-ink">{t('situation.label')}</label>
        <p id="situation-hint" className="ga-ui text-ga-caption text-ga-muted">{t('situation.hint')}</p>
        <textarea
          id="situation"
          rows={4}
          className={studioField}
          value={value}
          disabled={locked}
          maxLength={1000}
          aria-describedby="situation-hint"
          placeholder={t(`situation.placeholder.${teilKind(draft.teilType)}`)}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <GaBtn variant="yellow" size="sm" disabled={locked || !dirty} onClick={save}>
            <Save size={14} aria-hidden /> {t('situation.save')}
          </GaBtn>
          <GaBtn variant="primary" size="sm" disabled={dirty} onClick={onNext}>{t('next')}</GaBtn>
          {dirty && <span className="ga-ui text-ga-caption text-ga-muted">{t('unsaved')}</span>}
        </div>
      </GaCard>
    </div>
  )
}
