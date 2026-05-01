'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import api, { apiMessage } from '@/lib/api'
import { Search } from 'lucide-react'
import AdminShell from '@/components/admin/AdminShell'
import useAdminData from '@/hooks/useAdminData'

type AdminUser = {
  id: number
  email: string
  displayName: string
  role: 'ADMIN' | 'TEACHER' | 'STUDENT'
  isActive: boolean
  planCode?: string
  monthlyTokenLimit?: number
  usedThisMonth?: number
  remainingThisMonth?: number
  quotaPeriodStartUtc?: string
  quotaPeriodEndUtc?: string
  subscriptionStartsAtUtc?: string | null
  subscriptionEndsAtUtc?: string | null
}

type PlanRow = {
  code: string
  name: string
  monthlyTokenLimit: number
  isActive: boolean
}

type UsageRow = {
  id: number
  userId: number
  provider?: string
  model?: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  feature?: string
  requestId?: string
  sessionId?: number
  createdAt?: string
}

function fmt(n: number | undefined) {
  return Number(n ?? 0).toLocaleString('vi-VN')
}

function shortIso(iso: string | null | undefined) {
  if (iso == null || String(iso).trim() === '') return null
  try {
    const d = new Date(String(iso))
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 19).replace('T', ' ')
    return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return String(iso)
  }
}

export default function AdminUsersPage() {
  const [items, setItems] = useState<AdminUser[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [roleErrorId, setRoleErrorId] = useState<number | null>(null)
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [detailUser, setDetailUser] = useState<AdminUser | null>(null)
  const [planCode, setPlanCode] = useState('FREE')
  const [overrideLimit, setOverrideLimit] = useState('')
  const [usage, setUsage] = useState<UsageRow[]>([])
  const [usageLoading, setUsageLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [modalError, setModalError] = useState('')
  const [startsAtUtcInput, setStartsAtUtcInput] = useState('')
  const [endsAtUtcInput, setEndsAtUtcInput] = useState('')

  const { data, loading, refreshing, error, lastSyncedAt, reload } = useAdminData<AdminUser[]>({
    initialData: [],
    errorMessage: 'Không thể tải danh sách người dùng.',
    fetchData: async () => {
      const res = await api.get('/admin/users')
      return (res.data ?? []) as AdminUser[]
    },
  })

  useEffect(() => {
    setItems(data)
  }, [data])

  useEffect(() => {
    let cancelled = false
    api
      .get('/admin/plans')
      .then((res) => {
        if (!cancelled) setPlans((res.data ?? []) as PlanRow[])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const updateRole = async (id: number, role: string) => {
    setRoleErrorId(null)
    try {
      await api.patch(`/admin/users/${id}/role`, { role })
      await reload({ silent: true })
    } catch (e: unknown) {
      setRoleErrorId(id)
      console.error(apiMessage(e))
    }
  }

  const openDetail = async (u: AdminUser) => {
    setDetailUser(u)
    setPlanCode((u.planCode || 'FREE').toUpperCase())
    setOverrideLimit('')
    setStartsAtUtcInput(
      u.subscriptionStartsAtUtc != null && String(u.subscriptionStartsAtUtc).trim() !== ''
        ? String(u.subscriptionStartsAtUtc)
        : new Date().toISOString()
    )
    setEndsAtUtcInput(u.subscriptionEndsAtUtc != null ? String(u.subscriptionEndsAtUtc) : '')
    setModalError('')
    setUsage([])
    setUsageLoading(true)
    try {
      const res = await api.get(`/admin/users/${u.id}/usage`, { params: { limit: 200 } })
      setUsage((res.data ?? []) as UsageRow[])
    } catch (e: unknown) {
      setModalError(apiMessage(e))
    } finally {
      setUsageLoading(false)
    }
  }

  const savePlan = async () => {
    if (!detailUser) return
    setSaveLoading(true)
    setModalError('')
    try {
      await api.patch(`/admin/users/${detailUser.id}/plan`, {
        planCode,
        monthlyTokenLimitOverride: overrideLimit.trim() ? Number(overrideLimit.trim()) : null,
        startsAtUtc: startsAtUtcInput.trim() || new Date().toISOString(),
        endsAtUtc: endsAtUtcInput.trim() ? endsAtUtcInput.trim() : null,
      })
      await reload({ silent: true })
      setDetailUser(null)
    } catch (e: unknown) {
      setModalError(apiMessage(e))
    } finally {
      setSaveLoading(false)
    }
  }

  const filteredItems = items.filter((u) => {
    const q = query.trim().toLowerCase()
    const matchesQ =
      !q ||
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      String(u.id).includes(q) ||
      u.role.toLowerCase().includes(q) ||
      (u.planCode || '').toLowerCase().includes(q)
    const matchesStatus =
      statusFilter === 'all' || (statusFilter === 'active' ? u.isActive : !u.isActive)
    return matchesQ && matchesStatus
  })

  const listHint = (() => {
    if (error && items.length === 0 && !loading) {
      return 'Kiểm tra Spring Boot (thường :8080), biến NEXT_PUBLIC_BACKEND_URL / BACKEND_URL trên Next, và JWT tài khoản ADMIN.'
    }
    return null
  })()

  if (loading) return <div className="page-shell text-muted-foreground">Đang tải người dùng…</div>

  return (
    <AdminShell
      title="Quản lý người dùng"
      subtitle="Phân quyền · gói đăng ký (cấp độ) · quota token AI (tháng UTC)"
      activeNav="students"
      error={error}
      refreshing={refreshing}
      onRefresh={() => reload({ silent: true })}
      lastSyncedAt={lastSyncedAt}
    >
      {listHint && error && (
        <p className="mb-3 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{listHint}</p>
      )}

      <div className="section-card rounded-[14px] border border-[#E2E8F0]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-3">
          <div className="relative md:w-[320px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên, email, role, plan…"
              className="w-full input pl-8 h-9 py-1 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-0.5 text-xs font-semibold">
              {(['all', 'active', 'inactive'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setStatusFilter(k)}
                  className={`rounded-[6px] px-2.5 py-1.5 transition-colors ${
                    statusFilter === k ? 'bg-[#00305E] text-white' : 'text-[#64748B] hover:bg-white'
                  }`}
                >
                  {k === 'all' ? 'Tất cả' : k === 'active' ? 'Đang hoạt động' : 'Không hoạt động'}
                </button>
              ))}
            </div>
            <Link
              href="/admin/plans"
              className="text-xs font-semibold text-[#00305E] underline-offset-2 hover:underline"
            >
              Danh sách gói & hạn mức token
            </Link>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="empty-state text-sm text-muted-foreground">
            {error && items.length === 0 ? (
              <>Chưa có dữ liệu do lỗi tải. Xem báo đỏ phía trên hoặc bấm làm mới.</>
            ) : items.length === 0 ? (
              <>Chưa có người dùng trong hệ thống.</>
            ) : (
              <>Không có người dùng phù hợp bộ lọc hoặc từ khóa.</>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((u) => (
              <div key={u.id} className="list-item flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{u.displayName}</p>
                  <p className="text-sm text-muted-foreground">
                    #{u.id} · {u.email} · {u.isActive ? 'Active' : 'Inactive'}
                  </p>
                  <p className="text-xs text-[#64748B] mt-1">
                    <span className="font-medium text-[#00305E]">{u.planCode ?? '—'}</span>
                    {' · '}Đã dùng: {fmt(u.usedThisMonth)}
                    {' · '}Còn: {fmt(u.remainingThisMonth)}
                    {' · '}Hạn mức: {fmt(u.monthlyTokenLimit)}
                  </p>
                  {(shortIso(u.subscriptionStartsAtUtc) || u.subscriptionEndsAtUtc != null) && (
                    <p className="text-[11px] text-[#475569] mt-0.5">
                      Đăng ký:&nbsp;
                      {shortIso(u.subscriptionStartsAtUtc) ?? '?'}
                      {' → '}
                      {shortIso(u.subscriptionEndsAtUtc) ?? 'Không có ngày kết thúc'}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full bg-[#EEF4FF] px-2 py-0.5 text-xs font-semibold text-[#00305E]">
                    {u.role}
                  </span>
                  <select
                    className={`input py-1 px-2 text-sm ${roleErrorId === u.id ? 'border-red-400 ring-1 ring-red-200' : ''}`}
                    value={u.role}
                    onChange={(e) => updateRole(u.id, e.target.value)}
                    aria-invalid={roleErrorId === u.id}
                  >
                    <option value="STUDENT">STUDENT</option>
                    <option value="TEACHER">TEACHER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                  {roleErrorId === u.id && (
                    <span className="text-[10px] text-red-600">Không đổi được role — xem Network / Console</span>
                  )}
                  <button
                    type="button"
                    onClick={() => openDetail(u)}
                    className="rounded-[8px] bg-[#00305E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#002447]"
                  >
                    Chi tiết quota
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: plan + usage */}
      {detailUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Đóng"
            onClick={() => setDetailUser(null)}
          />
          <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-[14px] border border-[#E2E8F0] bg-white shadow-xl flex flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] px-4 py-3">
              <div>
                <p className="font-bold text-foreground">{detailUser.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  #{detailUser.id} · {detailUser.email}
                </p>
              </div>
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setDetailUser(null)}
              >
                Đóng
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-4 space-y-4 flex-1">
              {modalError && (
                <div className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {modalError}
                </div>
              )}
              <div className="rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Đổi gói</p>
                {detailUser && (
                  <p className="text-xs text-muted-foreground">
                    Gói hiện tại trên máy chủ: <span className="font-mono font-semibold text-foreground">{detailUser.planCode ?? '—'}</span>{' '}
                    · Bắt đầu: {shortIso(detailUser.subscriptionStartsAtUtc) ?? '—'} · Kết thúc:&nbsp;
                    {shortIso(detailUser.subscriptionEndsAtUtc) ?? 'Mở (null)'}
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm sm:col-span-2">
                    <span className="text-muted-foreground">
                      Ngày bắt đầu đăng ký (UTC, ISO‑8601) — ví dụ 2027-06-01T00:00:00Z
                    </span>
                    <input
                      className="input mt-1 w-full py-2 text-sm font-mono"
                      value={startsAtUtcInput}
                      onChange={(e) => setStartsAtUtcInput(e.target.value)}
                      placeholder='2027-06-01T00:00:00Z'
                    />
                  </label>
                  <label className="block text-sm sm:col-span-2">
                    <span className="text-muted-foreground">
                      Ngày kết thúc đăng ký (để trống = không hạn đến khi đổi gói)
                    </span>
                    <input
                      className="input mt-1 w-full py-2 text-sm font-mono"
                      value={endsAtUtcInput}
                      onChange={(e) => setEndsAtUtcInput(e.target.value)}
                      placeholder=""
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-muted-foreground">Plan code</span>
                    <select
                      className="input mt-1 w-full py-2 text-sm"
                      value={planCode}
                      onChange={(e) => setPlanCode(e.target.value)}
                    >
                      {plans.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.code} — {p.name}
                        </option>
                      ))}
                      {plans.length === 0 && <option value="FREE">FREE</option>}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="text-muted-foreground">Override token/tháng (tuỳ chọn)</span>
                    <input
                      className="input mt-1 w-full py-2 text-sm"
                      placeholder="Để trống = theo gói"
                      value={overrideLimit}
                      onChange={(e) => setOverrideLimit(e.target.value)}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  disabled={saveLoading}
                  onClick={savePlan}
                  className="rounded-[8px] bg-[#FFCE00] px-4 py-2 text-sm font-semibold text-[#00305E] disabled:opacity-60"
                >
                  {saveLoading ? 'Đang lưu…' : 'Lưu gói'}
                </button>
                <p className="text-[10px] text-muted-foreground font-mono">PATCH /api/admin/users/:id/plan</p>
              </div>

              <div>
                <p className="text-sm font-semibold text-foreground mb-2">Nhật ký usage (200 bản ghi gần nhất)</p>
                {usageLoading ? (
                  <p className="text-sm text-muted-foreground">Đang tải…</p>
                ) : (
                  <div className="overflow-x-auto rounded-[10px] border border-[#E2E8F0]">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[#F8FAFC] text-left font-semibold text-[#64748B]">
                          <th className="px-2 py-2">Thời điểm</th>
                          <th className="px-2 py-2">Feature</th>
                          <th className="px-2 py-2">Provider / Model</th>
                          <th className="px-2 py-2">Tokens</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usage.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-2 py-6 text-center text-muted-foreground">
                              Chưa có sự kiện usage.
                            </td>
                          </tr>
                        ) : (
                          usage.map((r) => (
                            <tr key={r.id} className="border-t border-[#E2E8F0]">
                              <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">
                                {r.createdAt ? String(r.createdAt) : '—'}
                              </td>
                              <td className="px-2 py-2 font-medium">{r.feature ?? '—'}</td>
                              <td className="px-2 py-2 text-muted-foreground">
                                {[r.provider, r.model].filter(Boolean).join(' / ') || '—'}
                              </td>
                              <td className="px-2 py-2 font-semibold">{fmt(r.totalTokens)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-2 font-mono">GET /api/admin/users/:id/usage?limit=200</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
