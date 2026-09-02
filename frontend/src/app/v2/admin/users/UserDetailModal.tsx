'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import { TkModal, GaBtn, GaCap, TkBadge, ErrorBanner, LoadingState, ConfirmDialog } from '@/components/ui-v2'
import type { PlanRow } from './page'

type GlobalRole = 'ADMIN' | 'TEACHER' | 'STUDENT'
/** Org-admin roles are first-class platform roles but are managed via the org console, not here. */
type AnyRole = GlobalRole | 'OWNER' | 'MANAGER'
const ROLES: GlobalRole[] = ['STUDENT', 'TEACHER', 'ADMIN']

type QuotaDetail = {
  quotaKind?: string
  unlimitedInternal?: boolean
  usageLast30Days?: number
  usedToday?: number
  usedThisMonth?: number
  remainingSpendable?: number
  remainingThisMonth?: number
  walletCap?: number
  walletBalance?: number
  dailyTokenGrant?: number
  periodStartUtc?: string
  periodEndUtc?: string
}
type UsageRow = {
  id: number
  createdAt?: string
  feature?: string
  provider?: string
  model?: string
  totalTokens?: number
}

interface UserDetailModalProps {
  userId: number
  userName: string
  email: string
  /** Current global role (users.role) — drives the role-change control. */
  role: AnyRole
  /** Whether the account is active — drives the lock/unlock control. */
  isActive: boolean
  planCode?: string
  plans: PlanRow[]
  onClose: () => void
  onSaved: () => void
  /** Open the (reused) learning-detail modal for this user. */
  onShowLearning?: () => void
}

const fmt = (n: number | undefined) => Number(n ?? 0).toLocaleString('vi-VN')
/** Ánh xạ quotaKind của backend sang khoá i18n (thay cho chuỗi tiếng Việt hardcode trước đây). */
function quotaKindKey(k: string | undefined): string {
  switch (k) {
    case 'WALLET':
      return 'quotaKind.wallet'
    case 'FREE_DAY':
      return 'quotaKind.freeDay'
    case 'INTERNAL_UNLIMITED':
      return 'quotaKind.internalUnlimited'
    default:
      return 'quotaKind.none'
  }
}
function planEnd(code: string, from: Date): string {
  const days: Record<string, number> = { FREE: 7, PRO: 30, ULTRA: 60 }
  const d = days[code.toUpperCase()]
  return d ? new Date(from.getTime() + d * 86_400_000).toISOString() : ''
}

export function UserDetailModal({
  userId,
  userName,
  email,
  role,
  isActive,
  planCode,
  plans,
  onClose,
  onSaved,
  onShowLearning,
}: UserDetailModalProps) {
  const t = useTranslations('v2.adminOps.users.detail')
  const [quota, setQuota] = useState<QuotaDetail | null>(null)
  const [usage, setUsage] = useState<UsageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Global role (separate audited endpoint from plan). currentRole is the saved
  // baseline so the button re-disables after a successful change.
  const [currentRole, setCurrentRole] = useState<AnyRole>(role)
  const [roleValue, setRoleValue] = useState<AnyRole>(role)
  const [savingRole, setSavingRole] = useState(false)
  // OWNER/MANAGER are org-scoped admin identities — their platform role mirrors org membership and is
  // changed via the org console, not this system-role dropdown.
  const isOrgAdmin = currentRole === 'OWNER' || currentRole === 'MANAGER'

  // Account active state — soft delete (lock/unlock). Reversible, admin-only.
  const [active, setActive] = useState(isActive)
  const [savingActive, setSavingActive] = useState(false)

  /**
   * Audit F-M11 (03/09/2026): KHÓA tài khoản là thao tác hủy hoại (chặn đăng nhập + chấm dứt mọi
   * phiên đang chạy sau bản vá F-H3) nhưng trước đây bắn thẳng ngay khi click, không hỏi lại.
   * MỞ khóa thì không cần xác nhận — nó khôi phục quyền truy cập chứ không lấy đi.
   */
  const [confirmLock, setConfirmLock] = useState(false)

  const applyActive = async (next: boolean) => {
    setSavingActive(true)
    setError('')
    try {
      await api.patch(`/admin/users/${userId}/active`, { active: next })
      setActive(next)
      toast.success(next ? t('unlocked') : t('locked'))
      onSaved()
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setSavingActive(false)
      setConfirmLock(false)
    }
  }

  const toggleActive = () => {
    if (active) {
      setConfirmLock(true)
      return
    }
    void applyActive(true)
  }

  // Admin reset password — đặt mật khẩu mới cho user (không cần mật khẩu cũ). Admin-only, audit.
  const [newPw, setNewPw] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  const resetPassword = async () => {
    if (newPw.length < 8) {
      setError(t('pwTooShort'))
      return
    }
    setSavingPw(true)
    setError('')
    try {
      await api.patch(`/admin/users/${userId}/password`, { password: newPw })
      setNewPw('')
      toast.success(t('pwDone'))
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setSavingPw(false)
    }
  }

  const [code, setCode] = useState((planCode || 'FREE').toUpperCase())
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [override, setOverride] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.allSettled([
      api.get<QuotaDetail>(`/admin/users/${userId}/quota`),
      api.get(`/admin/users/${userId}/usage`, { params: { limit: 200 } }),
    ]).then(([q, u]) => {
      if (cancelled) return
      if (q.status === 'fulfilled') setQuota(q.value.data ?? null)
      if (u.status === 'fulfilled') setUsage((u.value.data ?? []) as UsageRow[])
      if (q.status === 'rejected') setError(apiMessage(q.reason))
      else if (u.status === 'rejected') setError(apiMessage(u.reason))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const savePlan = async () => {
    setSaving(true)
    setError('')
    try {
      await api.patch(`/admin/users/${userId}/plan`, {
        planCode: code,
        monthlyTokenLimitOverride: override.trim() ? Number(override.trim()) : null,
        startsAtUtc: startsAt.trim() || new Date().toISOString(),
        endsAtUtc: endsAt.trim() ? endsAt.trim() : null,
      })
      onSaved()
      onClose()
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  /**
   * Audit F-M11 (03/09/2026): đổi vai trò hệ thống — nhất là gán ADMIN — trước đây bắn thẳng khi
   * click "Đổi". Nay phải xác nhận, và hộp thoại nêu rõ hệ quả (toàn quyền + cắt phiên + audit).
   */
  const [confirmRole, setConfirmRole] = useState(false)

  const applyRole = async () => {
    setSavingRole(true)
    setError('')
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: roleValue })
      setCurrentRole(roleValue)
      toast.success(t('roleChanged', { role: roleValue }))
      onSaved()
    } catch (e: unknown) {
      setError(apiMessage(e))
      setRoleValue(currentRole)
    } finally {
      setSavingRole(false)
      setConfirmRole(false)
    }
  }

  const saveRole = () => {
    if (roleValue === currentRole) return
    setConfirmRole(true)
  }

  const stat = (label: string, value: ReactNode) => (
    <div>
      <GaCap>{label}</GaCap>
      <p className="mt-1 font-semibold tabular-nums text-ga-ink">{value}</p>
    </div>
  )

  return (
    <>
    <TkModal
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={userName}
      description={`#${userId} · ${email}`}
      footer={
        <>
          {onShowLearning && (
            <GaBtn variant="ghost" onClick={onShowLearning} className="mr-auto">
              {t('learningProfile')}
            </GaBtn>
          )}
          <GaBtn variant="ghost" onClick={onClose}>
            {t('close')}
          </GaBtn>
          <GaBtn variant="primary" loading={saving} onClick={savePlan}>
            {t('saveChanges')}
          </GaBtn>
        </>
      }
    >
      {error && <ErrorBanner className="mb-4" message={error} />}

      {loading ? (
        <LoadingState variant="spinner" label={t('loadingQuotaUsage')} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Quota */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <GaCap>{t('quotaCap')}</GaCap>
                {quota?.unlimitedInternal && <TkBadge tone="green">{t('unlimited')}</TkBadge>}
              </div>
              {quota ? (
                <>
                  <p className="ga-ui text-[13px] text-ga-muted">{t(quotaKindKey(quota.quotaKind))}</p>
                  <div className="grid grid-cols-2 gap-4 text-[13px]">
                    {stat(t('stat.ledger30'), fmt(quota.usageLast30Days))}
                    {stat(t('stat.today'), fmt(quota.usedToday ?? quota.usedThisMonth))}
                    {stat(
                      t('stat.remainingSpendable'),
                      quota.unlimitedInternal ? '—' : fmt(quota.remainingSpendable ?? quota.remainingThisMonth),
                    )}
                    {stat(t('stat.walletCap'), fmt(quota.walletCap))}
                    {stat(t('stat.dailyGrant'), fmt(quota.dailyTokenGrant))}
                    {stat(t('stat.walletBalance'), fmt(quota.walletBalance))}
                  </div>
                </>
              ) : (
                <p className="ga-ui text-[13px] italic text-ga-muted">{t('noQuotaSnapshot')}</p>
              )}
            </section>

            {/* Role + Plan edit */}
            <section className="space-y-5">
              {/* Global role — separate audited endpoint (PATCH /admin/users/{id}/role) */}
              <div className="space-y-2 border-b border-ga-line pb-5">
                <GaCap>{t('roleCap')}</GaCap>
                <p className="ga-ui text-[13px] text-ga-muted">
                  {t('roleCurrent')} <span className="font-semibold text-ga-ink">{currentRole}</span>
                </p>
                {isOrgAdmin ? (
                  <p className="ga-ui text-[12px] text-ga-subtle">
                    {t('roleOrgAdminNote')}
                  </p>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <select
                        value={roleValue}
                        onChange={(e) => setRoleValue(e.target.value as GlobalRole)}
                        aria-label={t('roleCap')}
                        className="ga-ui min-w-0 flex-1 rounded-ga border border-ga-line bg-ga-card px-3 py-2 text-[13px] font-semibold text-ga-ink outline-none"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <GaBtn variant="primary" loading={savingRole} disabled={roleValue === currentRole} onClick={saveRole}>
                        {t('roleChange')}
                      </GaBtn>
                    </div>
                    <p className="ga-ui text-[12px] text-ga-subtle">{t('roleNote')}</p>
                  </>
                )}
              </div>

              {/* Account active state — soft delete (lock/unlock). Admin-only, reversible. */}
              <div className="space-y-2 border-b border-ga-line pb-5">
                <GaCap>{t('statusCap')}</GaCap>
                <p className="ga-ui text-[13px] text-ga-muted">
                  {t('roleCurrent')}{' '}
                  <span className={active ? 'font-semibold text-ga-green' : 'font-semibold text-ga-red'}>
                    {active ? t('statusActive') : t('statusLocked')}
                  </span>
                </p>
                <GaBtn variant={active ? 'ghost' : 'primary'} loading={savingActive} onClick={toggleActive}>
                  {active ? t('lockAccount') : t('unlockAccount')}
                </GaBtn>
                <p className="ga-ui text-[12px] text-ga-subtle">
                  {t('statusNote')}
                </p>
              </div>

              {/* Admin reset password — đặt lại mật khẩu cho user (gỡ default-cred / user quên pass). */}
              <div className="space-y-2 border-b border-ga-line pb-5">
                <GaCap>{t('pwCap')}</GaCap>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    autoComplete="new-password"
                    placeholder={t('pwPlaceholder')}
                    className="ga-ui min-w-0 flex-1 rounded-ga border border-ga-line bg-ga-card px-3 py-2 text-[13px] text-ga-ink outline-none placeholder:text-ga-subtle"
                  />
                  <GaBtn variant="primary" loading={savingPw} disabled={newPw.length < 8} onClick={resetPassword}>
                    {t('pwReset')}
                  </GaBtn>
                </div>
                <p className="ga-ui text-[12px] text-ga-subtle">
                  {t('pwNote')}
                </p>
              </div>

              <GaCap>{t('planCap')}</GaCap>
              <p className="ga-ui text-[13px] text-ga-muted">
                {t('planCurrent')} <span className="font-semibold text-ga-ink">{planCode ?? '—'}</span>
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
                  className="ga-ui mt-1 w-full rounded-ga border border-ga-line bg-ga-card px-3 py-2 text-[13px] font-semibold text-ga-ink outline-none"
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
                  className="ga-ui mt-1 w-full rounded-ga border border-ga-line bg-ga-card px-3 py-2 font-mono text-[12px] text-ga-ink outline-none placeholder:text-ga-subtle"
                />
              </label>
              <label className="block">
                <GaCap>{t('endsAt')}</GaCap>
                <input
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="ga-ui mt-1 w-full rounded-ga border border-ga-line bg-ga-card px-3 py-2 font-mono text-[12px] text-ga-ink outline-none placeholder:text-ga-subtle"
                />
              </label>
              <label className="block">
                <GaCap>{t('overrideLimit')}</GaCap>
                <input
                  value={override}
                  onChange={(e) => setOverride(e.target.value)}
                  placeholder="—"
                  className="ga-ui mt-1 w-full rounded-ga border border-ga-line bg-ga-card px-3 py-2 text-[13px] text-ga-ink outline-none placeholder:text-ga-subtle"
                />
              </label>
            </section>
          </div>

          {/* Usage log */}
          <section>
            <GaCap>{t('usageCap')}</GaCap>
            <div className="mt-2 max-h-64 overflow-x-auto overflow-y-auto rounded-ga border border-ga-line">
              <table className="ga-ui w-full min-w-[560px] border-collapse text-[12.5px] lg:min-w-0">
                <thead className="sticky top-0 bg-ga-side-active">
                  <tr>
                    {[t('usageCol.time'), t('usageCol.feature'), t('usageCol.providerModel'), t('usageCol.tokens')].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-ga-muted last:text-right"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usage.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center italic text-ga-muted">
                        {t('usageEmpty')}
                      </td>
                    </tr>
                  ) : (
                    usage.map((r) => (
                      <tr key={r.id} className="border-t border-ga-line">
                        <td className="whitespace-nowrap px-3 py-2 text-ga-muted">{r.createdAt ?? '—'}</td>
                        <td className="px-3 py-2 font-semibold text-ga-ink">{r.feature ?? '—'}</td>
                        <td className="px-3 py-2 text-ga-muted">
                          {[r.provider, r.model].filter(Boolean).join(' / ') || '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-ga-ink">
                          {fmt(r.totalTokens)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </TkModal>

      {/* Hai hộp xác nhận cho thao tác đặc quyền (audit F-M11). Đứng NGOÀI TkModal chính để không
          bị unmount theo nó và để nhận focus riêng. ConfirmDialog autoFocus vào nút Hủy. */}
      <ConfirmDialog
        open={confirmRole}
        onOpenChange={setConfirmRole}
        title={t('confirmRole.title')}
        description={t('confirmRole.description', { name: userName, from: currentRole, to: roleValue })}
        details={
          roleValue === 'ADMIN'
            ? [t('confirmRole.detailAdmin'), t('confirmRole.detailSessions'), t('confirmRole.detailAudit')]
            : [t('confirmRole.detailSessions'), t('confirmRole.detailAudit')]
        }
        confirmLabel={t('confirmRole.confirm')}
        cancelLabel={t('confirmRole.cancel')}
        loading={savingRole}
        onConfirm={() => void applyRole()}
      />

      <ConfirmDialog
        open={confirmLock}
        onOpenChange={setConfirmLock}
        title={t('confirmLock.title')}
        description={t('confirmLock.description', { name: userName })}
        details={[t('confirmLock.detailBlocked'), t('confirmLock.detailSessions'), t('confirmLock.detailReversible')]}
        confirmLabel={t('confirmLock.confirm')}
        cancelLabel={t('confirmLock.cancel')}
        loading={savingActive}
        onConfirm={() => void applyActive(false)}
      />
    </>
  )
}
