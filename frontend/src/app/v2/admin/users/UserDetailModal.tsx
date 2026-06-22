'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import { TkModal, GaBtn, GaCap, TkBadge, ErrorBanner, LoadingState } from '@/components/ui-v2'
import type { PlanRow } from './page'

type GlobalRole = 'ADMIN' | 'TEACHER' | 'STUDENT'
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
  role: GlobalRole
  planCode?: string
  plans: PlanRow[]
  onClose: () => void
  onSaved: () => void
  /** Open the (reused) learning-detail modal for this user. */
  onShowLearning?: () => void
}

const fmt = (n: number | undefined) => Number(n ?? 0).toLocaleString('vi-VN')
function quotaKindVi(k: string | undefined): string {
  switch (k) {
    case 'WALLET':
      return 'Ví (PRO/PREMIUM/ULTRA)'
    case 'FREE_DAY':
      return 'FREE / ngày VN'
    case 'INTERNAL_UNLIMITED':
      return 'Nội bộ không giới hạn'
    default:
      return 'Không quota'
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
  planCode,
  plans,
  onClose,
  onSaved,
  onShowLearning,
}: UserDetailModalProps) {
  const [quota, setQuota] = useState<QuotaDetail | null>(null)
  const [usage, setUsage] = useState<UsageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Global role (separate audited endpoint from plan). currentRole is the saved
  // baseline so the button re-disables after a successful change.
  const [currentRole, setCurrentRole] = useState<GlobalRole>(role)
  const [roleValue, setRoleValue] = useState<GlobalRole>(role)
  const [savingRole, setSavingRole] = useState(false)

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

  const saveRole = async () => {
    if (roleValue === currentRole) return
    setSavingRole(true)
    setError('')
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: roleValue })
      setCurrentRole(roleValue)
      toast.success(`Đã đổi vai trò thành ${roleValue}.`)
      onSaved()
    } catch (e: unknown) {
      setError(apiMessage(e))
      setRoleValue(currentRole)
    } finally {
      setSavingRole(false)
    }
  }

  const stat = (label: string, value: ReactNode) => (
    <div>
      <GaCap>{label}</GaCap>
      <p className="mt-1 font-semibold tabular-nums text-ga-ink">{value}</p>
    </div>
  )

  return (
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
              Hồ sơ học tập
            </GaBtn>
          )}
          <GaBtn variant="ghost" onClick={onClose}>
            Đóng
          </GaBtn>
          <GaBtn variant="primary" loading={saving} onClick={savePlan}>
            Lưu thay đổi
          </GaBtn>
        </>
      }
    >
      {error && <ErrorBanner className="mb-4" message={error} />}

      {loading ? (
        <LoadingState variant="spinner" label="Đang tải quota & usage…" />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Quota */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <GaCap>Chi tiết quota</GaCap>
                {quota?.unlimitedInternal && <TkBadge tone="green">Không giới hạn</TkBadge>}
              </div>
              {quota ? (
                <>
                  <p className="ga-ui text-[13px] text-ga-muted">{quotaKindVi(quota.quotaKind)}</p>
                  <div className="grid grid-cols-2 gap-4 text-[13px]">
                    {stat('Ledger 30 ngày', fmt(quota.usageLast30Days))}
                    {stat('Hôm nay (VN)', fmt(quota.usedToday ?? quota.usedThisMonth))}
                    {stat(
                      'Còn chi tiêu được',
                      quota.unlimitedInternal ? '—' : fmt(quota.remainingSpendable ?? quota.remainingThisMonth),
                    )}
                    {stat('Trần ví', fmt(quota.walletCap))}
                    {stat('Cộng mỗi ngày', fmt(quota.dailyTokenGrant))}
                    {stat('Số dư ví', fmt(quota.walletBalance))}
                  </div>
                </>
              ) : (
                <p className="ga-ui text-[13px] italic text-ga-muted">Chưa có snapshot quota.</p>
              )}
            </section>

            {/* Role + Plan edit */}
            <section className="space-y-5">
              {/* Global role — separate audited endpoint (PATCH /admin/users/{id}/role) */}
              <div className="space-y-2 border-b border-ga-line pb-5">
                <GaCap>Vai trò hệ thống</GaCap>
                <p className="ga-ui text-[13px] text-ga-muted">
                  Hiện tại: <span className="font-semibold text-ga-ink">{currentRole}</span>
                </p>
                <div className="flex items-center gap-2">
                  <select
                    value={roleValue}
                    onChange={(e) => setRoleValue(e.target.value as GlobalRole)}
                    aria-label="Vai trò hệ thống"
                    className="ga-ui flex-1 rounded-ga border border-ga-line bg-ga-card px-3 py-2 text-[13px] font-semibold text-ga-ink outline-none"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <GaBtn variant="primary" loading={savingRole} disabled={roleValue === currentRole} onClick={saveRole}>
                    Đổi
                  </GaBtn>
                </div>
                <p className="ga-ui text-[12px] text-ga-subtle">Đổi quyền truy cập toàn hệ thống — ghi log audit.</p>
              </div>

              <GaCap>Đổi gói đăng ký</GaCap>
              <p className="ga-ui text-[13px] text-ga-muted">
                Gói hiện tại: <span className="font-semibold text-ga-ink">{planCode ?? '—'}</span>
              </p>
              <label className="block">
                <GaCap>Plan code</GaCap>
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
                <GaCap>Bắt đầu (UTC)</GaCap>
                <input
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  placeholder="auto = bây giờ"
                  className="ga-ui mt-1 w-full rounded-ga border border-ga-line bg-ga-card px-3 py-2 font-mono text-[12px] text-ga-ink outline-none placeholder:text-ga-subtle"
                />
              </label>
              <label className="block">
                <GaCap>Kết thúc (trống = vô thời hạn)</GaCap>
                <input
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="ga-ui mt-1 w-full rounded-ga border border-ga-line bg-ga-card px-3 py-2 font-mono text-[12px] text-ga-ink outline-none placeholder:text-ga-subtle"
                />
              </label>
              <label className="block">
                <GaCap>Override limit (tuỳ chọn)</GaCap>
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
            <GaCap>Nhật ký usage (200 gần nhất)</GaCap>
            <div className="mt-2 max-h-64 overflow-y-auto rounded-ga border border-ga-line">
              <table className="ga-ui w-full border-collapse text-[12.5px]">
                <thead className="sticky top-0 bg-ga-side-active">
                  <tr>
                    {['Thời điểm', 'Tính năng', 'Provider/Model', 'Tokens'].map((h) => (
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
                        Không có lịch sử usage.
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
  )
}
