'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import { GaBtn, GaCap, GaPageHdr } from '@/components/ui-v2'
import { OrgOwnerOnly } from '../OwnerOnly'

// ─────────────────────────────────────────────────────────────────────────────
// Cấu hình trung tâm (PR-10, OWNER-only): P04 chính sách tính công + 2 ngưỡng
// gợi ý hỗ trợ (§7) + 2 ngưỡng xét chứng nhận (R10, V323). Backend gác
// assertOrgOwner; OrgOwnerOnly là lớp UX.
//
// Hai ngưỡng chứng nhận nhận SỐ NGUYÊN 0–100 (`OrgSettingsController.validate`), khác thang 1–100
// của hai ngưỡng gợi ý hỗ trợ ngay bên trên: 0 là giá trị HỢP LỆ và có nghĩa "trung tâm bỏ điều kiện
// đó", nên `min` của ô phải là 0 chứ không phải 1. Chúng quyết định dòng "đủ điều kiện cấp chứng
// nhận" in trên phiếu đánh giá CUỐI KHOÁ gửi gia đình — mặc định 50 điểm / 80 % chuyên cần.
// ─────────────────────────────────────────────────────────────────────────────

type Settings = Record<string, string>

const inputCls =
  'rounded-ga border border-ga-line bg-ga-bg px-2.5 py-1.5 text-[13.5px] text-ga-ink outline-none focus:border-ga-accent'

export default function V2OrgSettingsPage() {
  return (
    <OrgOwnerOnly>
      <SettingsInner />
    </OrgOwnerOnly>
  )
}

function SettingsInner() {
  const t = useTranslations('v2.org.settings')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get<Settings>('/org/settings')
      setSettings(res.data)
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const set = (key: string, value: string) =>
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))

  const save = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const res = await api.put<Settings>('/org/settings', { settings })
      setSettings(res.data)
      toast.success(t('saveSuccess'))
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-10">
        {error ? (
          <p className="m-0 border border-ga-line bg-ga-card px-4 py-6 text-center text-[13.5px] text-ga-red">{error}</p>
        ) : !settings ? (
          <div className="ga-shimmer h-[220px] max-w-[560px] border border-ga-line" aria-hidden />
        ) : (
          <div className="flex max-w-[560px] flex-col gap-5">
            {/* P04 — chính sách tính công */}
            <section className="border border-ga-line bg-ga-card p-4">
              <GaCap className="mb-2 block">{t('timesheetCap')}</GaCap>
              <label className="flex items-start gap-2.5 text-[13.5px] text-ga-ink">
                <input
                  type="checkbox"
                  checked={settings.timesheet_break_included === 'true'}
                  onChange={(e) => set('timesheet_break_included', e.target.checked ? 'true' : 'false')}
                  className="mt-0.5 h-4 w-4 accent-[var(--ga-accent)]"
                />
                <span>
                  {t('breakIncludedLabel')}
                  <span className="ga-ui mt-0.5 block text-[12px] leading-[1.5] text-ga-muted">{t('breakIncludedHint')}</span>
                </span>
              </label>
            </section>

            {/* §7 — ngưỡng gợi ý hỗ trợ */}
            <section className="border border-ga-line bg-ga-card p-4">
              <GaCap className="mb-2 block">{t('supportCap')}</GaCap>
              <div className="flex flex-col gap-3">
                <label className="flex flex-wrap items-center justify-between gap-2 text-[13.5px] text-ga-ink">
                  <span className="min-w-0 flex-1">{t('individualMaxLabel')}</span>
                  <input
                    type="number" min={1} max={100}
                    value={settings.support_individual_max ?? ''}
                    onChange={(e) => set('support_individual_max', e.target.value)}
                    className={`${inputCls} w-[86px]`}
                  />
                </label>
                <label className="flex flex-wrap items-center justify-between gap-2 text-[13.5px] text-ga-ink">
                  <span className="min-w-0 flex-1">{t('groupMinLabel')}</span>
                  <input
                    type="number" min={1} max={100}
                    value={settings.review_group_min ?? ''}
                    onChange={(e) => set('review_group_min', e.target.value)}
                    className={`${inputCls} w-[86px]`}
                  />
                </label>
                <p className="ga-ui m-0 text-[12px] leading-[1.5] text-ga-muted">{t('supportHint')}</p>
              </div>
            </section>

            {/* R10 — ngưỡng xét chứng nhận, in trên phiếu đánh giá cuối khoá */}
            <section className="border border-ga-line bg-ga-card p-4">
              <GaCap className="mb-2 block">{t('certificateCap')}</GaCap>
              <div className="flex flex-col gap-3">
                <label className="flex flex-wrap items-center justify-between gap-2 text-ga-body text-ga-ink">
                  <span className="min-w-0 flex-1">{t('certMinAvgLabel')}</span>
                  <input
                    type="number" min={0} max={100}
                    value={settings.certificate_min_avg ?? ''}
                    onChange={(e) => set('certificate_min_avg', e.target.value)}
                    className={`${inputCls} w-[86px]`}
                  />
                </label>
                <label className="flex flex-wrap items-center justify-between gap-2 text-ga-body text-ga-ink">
                  <span className="min-w-0 flex-1">{t('certMinAttendanceLabel')}</span>
                  <input
                    type="number" min={0} max={100}
                    value={settings.certificate_min_attendance_pct ?? ''}
                    onChange={(e) => set('certificate_min_attendance_pct', e.target.value)}
                    className={`${inputCls} w-[86px]`}
                  />
                </label>
                <p className="ga-ui m-0 text-ga-caption leading-[1.5] text-ga-muted">{t('certificateHint')}</p>
              </div>
            </section>

            <div className="flex justify-end">
              <GaBtn variant="primary" loading={saving} onClick={save}>{t('save')}</GaBtn>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
