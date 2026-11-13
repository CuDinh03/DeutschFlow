'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { adminUsersApi, type PlanRow, type QuotaDetail } from '@/lib/adminUsersApi'
import { GaBtn, GaCap, ConfirmDialog, ErrorBanner } from '@/components/ui-v2'
import { useFmt } from '@/lib/i18n/useFmt'

/** Gói có ví token cộng dồn: đổi sang các gói này thì ví bị ĐẶT LẠI; gói khác thì ví bị XOÁ. */
const WALLET_PLANS = new Set(['PRO', 'ULTRA'])

function planEnd(code: string, from: Date): string {
  const days: Record<string, number> = { FREE: 7, PRO: 30, ULTRA: 60 }
  const d = days[code.toUpperCase()]
  return d ? new Date(from.getTime() + d * 86_400_000).toISOString() : ''
}

export interface UserPlanPanelProps {
  userId: number
  userName: string
  /** Gói đang hiệu lực (từ hồ sơ). */
  currentPlan: string
  /** Quota lúc mở trang — dùng để nói rõ số dư ví sắp bị ảnh hưởng. */
  quota: QuotaDetail | null
  plans: PlanRow[]
  onChanged: () => void
}

/**
 * Đổi gói của một người dùng (tách từ UserDetailModal, 09/11/2026).
 *
 * Đổi gói KHÔNG hoàn tác được: backend kết thúc mọi gói ACTIVE, rồi đặt lại (PRO/ULTRA) hoặc xoá
 * (gói khác) ví token. Trước đây bấm "Lưu" là gửi ngay. Nay phải qua ConfirmDialog mức caution, nêu
 * gói cũ → mới và số dư ví hiện có, kèm lý do bắt buộc (vết ghi lý do + gói cũ + số dư cũ).
 */
export function UserPlanPanel({ userId, userName, currentPlan, quota, plans, onChanged }: UserPlanPanelProps) {
  const t = useTranslations('v2.adminOps.users.detail')
  const fmt = useFmt()
  const [code, setCode] = useState((currentPlan || 'FREE').toUpperCase())
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [override, setOverride] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const balance = quota?.walletBalance ?? 0
  const details = [
    t('confirmPlan.detailEndActive'),
    WALLET_PLANS.has(code)
      ? t('confirmPlan.detailWalletReset', { balance: fmt.num(balance), to: code })
      : t('confirmPlan.detailWalletCleared', { balance: fmt.num(balance) }),
    t('confirmPlan.detailSnapshot'),
    t('confirmPlan.detailAudit'),
  ]

  const save = async (reason: string) => {
    setSaving(true)
    setError('')
    try {
      await adminUsersApi.setPlan(userId, {
        planCode: code,
        monthlyTokenLimitOverride: override.trim() ? Number(override.trim()) : null,
        startsAtUtc: startsAt.trim() || new Date().toISOString(),
        endsAtUtc: endsAt.trim() ? endsAt.trim() : null,
        reason,
      })
      toast.success(t('confirmPlan.done', { plan: code }))
      onChanged()
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setSaving(false)
      setConfirm(false)
    }
  }

  const inputCls =
    'ga-ui mt-1 w-full rounded-ga border border-ga-line bg-ga-card px-3 py-2 text-ga-small text-ga-ink outline-none placeholder:text-ga-subtle'

  return (
    <section className="space-y-4" data-testid="user-plan-panel">
      {error && <ErrorBanner title={t('planErrorTitle')} message={error} />}
      <GaCap>{t('planCap')}</GaCap>
      <p className="ga-ui text-ga-small text-ga-muted">
        {t('planCurrent')} <span className="font-semibold text-ga-ink">{currentPlan || '—'}</span>
      </p>
      <label className="block">
        <GaCap>{t('planCode')}</GaCap>
        <select
          value={code}
          onChange={(e) => {
            const next = e.target.value
            setCode(next)
            const now = new Date()
            setStartsAt(now.toISOString())
            setEndsAt(planEnd(next, now))
          }}
          className={`${inputCls} font-semibold`}
          data-testid="plan-code"
        >
          {plans.length === 0 && <option value="FREE">FREE</option>}
          {plans.map((p) => (
            <option key={p.code} value={p.code}>
              {p.code}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <GaCap>{t('startsAt')}</GaCap>
        <input
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          placeholder={t('startsAtPlaceholder')}
          className={`${inputCls} font-mono`}
        />
      </label>
      <label className="block">
        <GaCap>{t('endsAt')}</GaCap>
        <input value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={`${inputCls} font-mono`} />
      </label>
      <label className="block">
        <GaCap>{t('overrideLimit')}</GaCap>
        <input value={override} onChange={(e) => setOverride(e.target.value)} placeholder="—" className={inputCls} />
      </label>
      <GaBtn variant="primary" loading={saving} onClick={() => setConfirm(true)} data-testid="plan-save">
        {t('confirmPlan.open')}
      </GaBtn>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        tone="caution"
        requireReason
        title={t('confirmPlan.title', { name: userName })}
        description={t('confirmPlan.description', { from: currentPlan || '—', to: code })}
        details={details}
        confirmLabel={t('confirmPlan.confirm')}
        cancelLabel={t('confirmPlan.cancel')}
        loading={saving}
        onConfirm={({ reason }) => reason && void save(reason)}
      />
    </section>
  )
}
