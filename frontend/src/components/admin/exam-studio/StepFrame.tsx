'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Save } from 'lucide-react'
import { patchDraft, type DifficultyPlan } from '@/lib/adminExamStudioApi'
import { checkMatrix, samePlan } from '@/lib/examStudioLogic'
import { GaBtn, GaCap, GaCard } from '@/components/ui-v2'
import { DifficultyMatrix } from './DifficultyMatrix'
import { ModeSelect, ThemeSelect } from './FrameFields'
import type { StudioStepProps } from './ui'

/** Bước 1 — Khung: thông số Teil (cố định Đợt 1), chủ đề, chế độ và ma trận độ khó. */
export function StepFrame({ draft, locked, run, onNext, canNext }: StudioStepProps & { onNext: () => void; canNext: boolean }) {
  const t = useTranslations('v2.adminContent.examStudio')
  const [theme, setTheme] = useState(draft.theme ?? '')
  const [mode, setMode] = useState(draft.mode)
  const [plan, setPlan] = useState<DifficultyPlan>(draft.difficultyPlan)
  const dirty = theme !== (draft.theme ?? '') || mode !== draft.mode || !samePlan(plan, draft.difficultyPlan)
  const check = checkMatrix(plan, mode, draft.itemCount)

  // Đồng bộ lại khi máy chủ đổi (vd sau khi lưu) mà người dùng chưa sửa gì.
  const serverKey = `${draft.theme}|${draft.mode}|${JSON.stringify(draft.difficultyPlan)}`
  useEffect(() => {
    setTheme(draft.theme ?? '')
    setMode(draft.mode)
    setPlan(draft.difficultyPlan)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey])

  const save = () =>
    run(() => patchDraft(draft.id, { theme: theme || null, mode, difficultyPlan: plan }), t('saved'))

  const facts: [string, string][] = [
    [t('frame.exam'), 'telc'],
    [t('frame.level'), draft.cefrLevel],
    [t('frame.section'), t.has(`section.${draft.section}`) ? t(`section.${draft.section}`) : draft.section],
    [t('frame.teil'), `Teil ${draft.teil}${draft.teilType ? ` · ${draft.teilType}` : ''}`],
    [t('frame.itemCount'), String(draft.itemCount)],
  ]

  return (
    <GaCard className="flex flex-col gap-5 p-4 sm:p-6">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt><GaCap>{k}</GaCap></dt>
            <dd className="ga-ui mt-0.5 text-ga-body font-semibold text-ga-ink">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ThemeSelect id="frame-theme" value={theme} onChange={setTheme} disabled={locked} />
        <ModeSelect value={mode} onChange={setMode} disabled={locked} />
      </div>

      {draft.itemCount > 0 ? (
        <div>
          <GaCap className="mb-2 block">{t('frame.matrix')}</GaCap>
          <DifficultyMatrix plan={plan} onChange={setPlan} mode={mode} itemCount={draft.itemCount} disabled={locked} />
        </div>
      ) : (
        <p className="ga-ui text-ga-small text-ga-muted">{t('frame.noMatrix')}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <GaBtn variant="yellow" size="sm" disabled={locked || !dirty || !check.valid} onClick={save}>
          <Save size={14} aria-hidden /> {t('frame.save')}
        </GaBtn>
        <GaBtn variant="primary" size="sm" disabled={dirty || !canNext} onClick={onNext}>{t('next')}</GaBtn>
        {dirty && <span className="ga-ui text-ga-caption text-ga-muted">{t('unsaved')}</span>}
      </div>
    </GaCard>
  )
}
