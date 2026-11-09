'use client'

import { useTranslations } from 'next-intl'
import { STUDIO_THEMES } from '@/lib/examStudioLogic'
import { GaCap, TkSeg } from '@/components/ui-v2'
import { studioField } from './ui'

/** Chủ đề (tuỳ chọn) — 10 chủ đề trung lập; để trống thì AI gợi ý theo chỗ còn thiếu trong kho. */
export function ThemeSelect({
  id, value, onChange, disabled,
}: { id: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const t = useTranslations('v2.adminContent.examStudio')
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block"><GaCap>{t('frame.theme')}</GaCap></label>
      <select id={id} className={studioField} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('frame.themeAny')}</option>
        {STUDIO_THEMES.map((th) => <option key={th} value={th}>{th}</option>)}
      </select>
    </div>
  )
}

/** Chế độ: Đề thi thử (tổng = số câu Teil) hay Bài luyện Teil (tự do). */
export function ModeSelect({
  value, onChange, disabled,
}: { value: 'EXAM' | 'PRACTICE'; onChange: (v: 'EXAM' | 'PRACTICE') => void; disabled?: boolean }) {
  const t = useTranslations('v2.adminContent.examStudio')
  return (
    <div>
      <GaCap className="mb-1.5 block">{t('frame.mode')}</GaCap>
      <div className={disabled ? 'pointer-events-none opacity-60' : undefined}>
        <TkSeg
          aria-label={t('frame.mode')}
          value={value}
          onValueChange={onChange}
          options={[
            { value: 'EXAM', label: t('mode.EXAM') },
            { value: 'PRACTICE', label: t('mode.PRACTICE') },
          ]}
        />
      </div>
      <p className="ga-ui mt-1.5 text-ga-caption text-ga-muted">{t(`modeHint.${value}`)}</p>
    </div>
  )
}
