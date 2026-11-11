'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { createDraft, DIFFICULTY_PRESETS, type DifficultyPlan, type StudioDraft } from '@/lib/adminExamStudioApi'
import { LEVEL_SECTION_TEILS, STUDIO_LEVELS, catalogEntry, checkMatrix, scalePlan, teilKind } from '@/lib/examStudioLogic'
import { GaBtn, GaCap, TkModal } from '@/components/ui-v2'
import { DifficultyMatrix } from './DifficultyMatrix'
import { ModeSelect, ThemeSelect } from './FrameFields'
import { studioField } from './ui'

/** Teil của từng phần thi theo cấp (LEVEL_SECTION_TEILS); Teil có trong STUDIO_TEIL_CATALOG mới chọn được, còn lại "Đợt sau". */
const teilsOf = (level: string, sec: string) => LEVEL_SECTION_TEILS[level]?.[sec] ?? []
const sectionsOf = (level: string) => Object.keys(LEVEL_SECTION_TEILS[level] ?? {})
const sectionEnabled = (level: string, sec: string) => teilsOf(level, sec).some((n) => catalogEntry(sec, n, level) != null)
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
  const [level, setLevel] = useState<string>('B1')
  const [section, setSection] = useState('LESEN')
  const [teil, setTeil] = useState(2)
  const [plan, setPlan] = useState<DifficultyPlan>(() => realPlan(5))
  const [situation, setSituation] = useState('')
  const [saving, setSaving] = useState(false)
  const entry = catalogEntry(section, teil, level)
  const itemCount = entry?.itemCount ?? 0
  const kind = teilKind(entry?.teilType)
  const check = checkMatrix(plan, mode, itemCount)

  /** Đổi phần/Teil: nhảy về Teil đầu tiên mở được và đặt lại ma trận theo số câu của Teil mới. */
  const pick = (sec: string, n?: number, lv: string = level) => {
    const teilNo = n ?? teilsOf(lv, sec).find((x) => catalogEntry(sec, x, lv) != null) ?? 1
    setSection(sec)
    setTeil(teilNo)
    setPlan(realPlan(catalogEntry(sec, teilNo, lv)?.itemCount ?? 0))
  }
  /** Đổi cấp: giữ phần đang chọn nếu cấp mới có, không thì về Lesen. */
  const pickLevel = (lv: string) => {
    setLevel(lv)
    const sec = sectionEnabled(lv, section) ? section : 'LESEN'
    const keepTeil = catalogEntry(sec, teil, lv) != null ? teil : undefined
    pick(sec, keepTeil, lv)
  }

  const submit = async () => {
    if (!check.valid || !entry) return
    setSaving(true)
    try {
      const d = await createDraft({
        examFormat: 'TELC', cefrLevel: level, section, teil,
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
            <label htmlFor="create-level" className="mb-1.5 block"><GaCap>{t('frame.level')}</GaCap></label>
            <select id="create-level" className={studioField} value={level} onChange={(e) => pickLevel(e.target.value)}>
              {STUDIO_LEVELS.map((lv) => <option key={lv} value={lv}>{t(`levelName.${lv}`)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="create-section" className="mb-1.5 block"><GaCap>{t('frame.section')}</GaCap></label>
            <select id="create-section" className={studioField} value={section} onChange={(e) => pick(e.target.value)}>
              {sectionsOf(level).map((sec) => (
                <option key={sec} value={sec} disabled={!sectionEnabled(level, sec)}>
                  {t(`section.${sec}`)}{sectionEnabled(level, sec) ? '' : ` — ${t('later')}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="create-teil" className="mb-1.5 block"><GaCap>{t('frame.teil')}</GaCap></label>
            <select id="create-teil" className={studioField} value={String(teil)}
              onChange={(e) => pick(section, Number(e.target.value))}>
              {teilsOf(level, section).map((n) => {
                const ok = catalogEntry(section, n, level) != null
                return (
                  <option key={n} value={String(n)} disabled={!ok}>
                    Teil {n}{ok ? '' : ` — ${t('later')}`}
                  </option>
                )
              })}
            </select>
          </div>
        </div>
        <p className="ga-ui text-ga-caption text-ga-muted">{t(`frame.blueprintKind.${kind === 'MATCH_AD_X' && level === 'A2' ? 'MATCH_AD_X_A2' : kind}`, { itemCount })}</p>

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
