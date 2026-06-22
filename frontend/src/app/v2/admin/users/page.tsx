'use client'

import { useEffect, useMemo, useState } from 'react'
import { UserPlus } from 'lucide-react'
import api from '@/lib/api'
import useAdminData from '@/hooks/useAdminData'
import LearningDetailModal from '@/components/admin/LearningDetailModal'
import {
  GaPageHdr,
  GaBtn,
  TkSearch,
  DataTable,
  type DataTableColumn,
} from '@/components/ui-v2'
import { cn } from '@/lib/utils'
import { UserDetailModal } from './UserDetailModal'
import { AdminCreateUserModal } from './AdminCreateUserModal'

// ── Normalized row (Prototype A shape) ───────────────────────────────────────
type AdminUser = {
  id: number
  email: string
  displayName: string
  role: 'ADMIN' | 'OWNER' | 'MANAGER' | 'TEACHER' | 'STUDENT'
  isActive: boolean
  planCode?: string
  /** True for INTERNAL_UNLIMITED — no meter, render "Không giới hạn". */
  unlimited: boolean
  /** False when there is no quota cap (quotaKind NONE / limit 0) — render "—". */
  hasQuota: boolean
  /** 0-100 AI-quota utilization = used / cap (current VN window), only when hasQuota. */
  quotaPercent: number
}
export type PlanRow = { code: string; name: string }

/**
 * Role tints (Prototype A — avatar bg + RoleBadge bg/text).
 * ADMIN = red (not navy). STUDENT = blue. TEACHER = violet. MANAGER = teal. OWNER = amber.
 */
const ROLE_TINT = {
  STUDENT: { c: '#2F6FC9', s: 'rgba(47,111,201,0.12)' },
  TEACHER: { c: '#7C56C8', s: 'rgba(124,86,200,0.12)' },
  MANAGER: { c: '#0E7C7B', s: 'rgba(14,124,123,0.12)' },
  OWNER:   { c: '#B26A00', s: 'rgba(178,106,0,0.12)' },
  ADMIN:   { c: '#DA291C', s: 'rgba(218,41,28,0.10)' },
} as const

/**
 * GET /admin/users: SQL-projected columns fold lower-case (displayname, isactive,
 * createdat); the quota fields are Java-map keys → exact camelCase. Normalize once
 * so the UI reads one canonical shape. Same endpoint/hook — just reads more fields.
 *
 * Quota meter = AI-quota *utilization* against the effective cap (QuotaSnapshot:
 * monthlyTokenLimit = walletCap for paid tiers, else dailyTokenGrant). used =
 * limit − remainingThisMonth. usageLast30Days is a raw token COUNT, not a %, so it
 * is NOT the bar value.
 */
function normalizeUser(r: Record<string, unknown>): AdminUser {
  const pick = (...keys: string[]) => {
    for (const k of keys) if (r[k] !== undefined && r[k] !== null) return r[k]
    return undefined
  }
  const num = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  const unlimited = pick('unlimitedInternal') === true || pick('quotaKind') === 'INTERNAL_UNLIMITED'
  const limit = num(pick('monthlyTokenLimit'))
  const remaining = num(pick('remainingThisMonth'))
  const used = Math.max(0, limit - remaining)
  const hasQuota = !unlimited && limit > 0
  return {
    id: Number(pick('id')),
    email: String(pick('email') ?? ''),
    role: (pick('role') as AdminUser['role']) ?? 'STUDENT',
    displayName: String(pick('displayName', 'displayname') ?? ''),
    isActive: pick('isActive', 'isactive') !== false,
    planCode: pick('planCode', 'plancode') as string | undefined,
    unlimited,
    hasQuota,
    quotaPercent: hasQuota ? Math.min(100, Math.round((used / limit) * 100)) : 0,
  }
}

type RoleFilter = 'all' | 'STUDENT' | 'TEACHER' | 'MANAGER' | 'OWNER' | 'ADMIN'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function quotaColor(pct: number): string {
  if (pct >= 90) return 'var(--ga-red)'
  if (pct >= 70) return 'var(--ga-orange)'
  return 'var(--ga-green)'
}

// ── AdStat strip cell ─────────────────────────────────────────────────────────
function AdStat({
  label,
  value,
  color,
  sub,
  alert,
}: {
  label: string
  value: number
  color: string
  sub?: string
  alert?: boolean
}) {
  return (
    <div className="relative border-l border-ga-border px-6 py-[22px]" style={{ background: `${color}0e` }}>
      <div className="absolute inset-x-0 top-0 h-[5px]" style={{ background: color }} />
      <p className="ga-ui mb-[10px] text-[10px] font-semibold uppercase tracking-[0.08em] text-ga-muted">
        {label}
      </p>
      <p className="font-ga-display text-[36px] font-medium leading-none" style={{ color }}>
        {value}
      </p>
      {sub && (
        <p className={cn('ga-ui mt-2 flex items-center gap-1.5 text-[13px]', alert ? 'text-ga-red' : 'text-ga-muted')}>
          {alert && <span className="inline-block h-1.5 w-1.5 rounded-full bg-ga-red" />}
          {sub}
        </p>
      )}
    </div>
  )
}

export default function V2AdminUsersPage() {
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [detailUser, setDetailUser] = useState<AdminUser | null>(null)
  const [learningUser, setLearningUser] = useState<AdminUser | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const { data, loading, error, reload } = useAdminData<AdminUser[]>({
    initialData: [],
    errorMessage: 'Không thể tải danh sách người dùng.',
    fetchData: async () => {
      const res = await api.get('/admin/users')
      return ((res.data ?? []) as Record<string, unknown>[]).map(normalizeUser)
    },
  })

  useEffect(() => {
    let cancelled = false
    api
      .get('/admin/plans')
      .then((res) => !cancelled && setPlans((res.data ?? []) as PlanRow[]))
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const counts = useMemo(
    () => ({
      total: data.length,
      student: data.filter((u) => u.role === 'STUDENT').length,
      teacher: data.filter((u) => u.role === 'TEACHER').length,
      manager: data.filter((u) => u.role === 'MANAGER').length,
      owner: data.filter((u) => u.role === 'OWNER').length,
      admin: data.filter((u) => u.role === 'ADMIN').length,
      paused: data.filter((u) => !u.isActive).length,
    }),
    [data],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.filter((u) => {
      const matchQ =
        !q ||
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        String(u.id).includes(q)
      const matchRole = roleFilter === 'all' || u.role === roleFilter
      return matchQ && matchRole
    })
  }, [data, query, roleFilter])

  const ROLE_FILTERS: { value: RoleFilter; label: string; count?: number }[] = [
    { value: 'all', label: 'Tất cả' },
    { value: 'STUDENT', label: 'STUDENT', count: counts.student },
    { value: 'TEACHER', label: 'TEACHER', count: counts.teacher },
    { value: 'MANAGER', label: 'MANAGER', count: counts.manager },
    { value: 'OWNER', label: 'OWNER', count: counts.owner },
    { value: 'ADMIN', label: 'ADMIN', count: counts.admin },
  ]

  const columns: DataTableColumn<AdminUser>[] = [
    {
      key: 'user',
      header: 'Tài khoản',
      sortable: true,
      sortValue: (u) => u.displayName.toLowerCase(),
      render: (u) => {
        const t = ROLE_TINT[u.role]
        return (
          <div className="flex items-center gap-3">
            <span
              className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-[13px] font-bold"
              style={{ background: t.s, color: t.c }}
            >
              {initials(u.displayName || 'U')}
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-ga-ink">{u.displayName}</p>
              <p className="truncate text-[12px] text-ga-muted">{u.email}</p>
            </div>
          </div>
        )
      },
    },
    {
      key: 'role',
      header: 'Vai trò',
      render: (u) => {
        const t = ROLE_TINT[u.role]
        return (
          <span
            className="inline-block rounded-ga px-[9px] py-1 text-[10px] font-bold tracking-[0.06em]"
            style={{ background: t.s, color: t.c }}
          >
            {u.role}
          </span>
        )
      },
    },
    {
      key: 'plan',
      header: 'Gói',
      render: (u) => <span className="text-[13.5px] text-ga-ink">{u.planCode || '—'}</span>,
    },
    {
      key: 'quota',
      header: 'Hạn mức AI',
      render: (u) => {
        if (u.unlimited) return <span className="text-[12px] text-ga-subtle">Không giới hạn</span>
        if (!u.hasQuota) return <span className="text-[12px] text-ga-subtle">—</span>
        return (
          <div className="pr-[18px]">
            <div className="h-[5px] overflow-hidden rounded-[3px] bg-ga-border">
              <div
                className="h-full rounded-[3px] transition-[width]"
                style={{ width: `${u.quotaPercent}%`, background: quotaColor(u.quotaPercent) }}
              />
            </div>
            <p className="mt-1 text-[11px] text-ga-muted">{u.quotaPercent}% dùng</p>
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (u) => (
        <span
          className="ga-ui inline-flex items-center gap-1.5 text-[12.5px]"
          style={{ color: u.isActive ? 'var(--ga-green)' : 'var(--ga-muted)' }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: u.isActive ? 'var(--ga-green)' : 'var(--ga-subtle)' }}
          />
          {u.isActive ? 'Hoạt động' : 'Tạm dừng'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (u) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setDetailUser(u)
          }}
          className="ga-ui rounded-ga border border-ga-line px-[10px] py-[6px] text-[11px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent"
        >
          Quản lý
        </button>
      ),
    },
  ]

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title="Quản lý người dùng"
        subtitle="Phân quyền, gói cước và hạn mức của từng tài khoản"
        right={
          <>
            <TkSearch
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm tên / email…"
              containerClassName="w-[230px]"
            />
            <GaBtn variant="yellow" onClick={() => setShowCreate(true)}>
              <UserPlus size={16} aria-hidden />
              Thêm người dùng
            </GaBtn>
          </>
        }
      />

      <div className="flex-1 px-10 py-6">
        {/* AdStat strip — always visible (0 when loading) */}
        <div className="mb-[22px] grid grid-cols-4 border border-ga-border border-l-0">
          <AdStat label="Tổng người dùng" value={counts.total} color="var(--ga-navy)" />
          <AdStat label="Học viên" value={counts.student} color="var(--ga-blue)" />
          <AdStat label="Giáo viên" value={counts.teacher} color="var(--ga-violet)" />
          <AdStat
            label="Tạm dừng"
            value={counts.paused}
            color="var(--ga-orange)"
            sub={counts.paused > 0 ? 'cần xem lại' : 'không có'}
            alert={counts.paused > 0}
          />
        </div>

        {/* Role filter */}
        <div className="mb-[18px] flex gap-2">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setRoleFilter(f.value)}
              className={cn(
                'ga-ui cursor-pointer rounded-ga border px-[14px] py-2 text-[12.5px] font-semibold transition-colors',
                roleFilter === f.value
                  ? 'border-ga-ink bg-ga-ink text-ga-card'
                  : 'border-ga-border bg-ga-card text-ga-muted hover:border-ga-ink hover:text-ga-ink',
              )}
            >
              {f.label}
              {f.count != null && <span className="ml-1.5 opacity-70">{f.count}</span>}
            </button>
          ))}
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(u) => u.id}
          loading={loading}
          error={error || null}
          onRetry={() => reload({ silent: false })}
          errorEndpoint="GET /api/admin/users"
          itemNoun="người dùng"
          pageSize={0}
          rowClassName={(u) => (!u.isActive ? 'opacity-60' : undefined)}
          onRowClick={(u) => setDetailUser(u)}
          empty={
            <div className="px-10 py-7 text-center">
              <p className="ga-ui text-[14.5px] text-ga-muted">Không tìm thấy người dùng.</p>
            </div>
          }
        />
      </div>

      {detailUser && (
        <UserDetailModal
          userId={detailUser.id}
          userName={detailUser.displayName}
          email={detailUser.email}
          role={detailUser.role}
          isActive={detailUser.isActive}
          planCode={detailUser.planCode}
          plans={plans}
          onClose={() => setDetailUser(null)}
          onSaved={() => reload({ silent: true })}
          onShowLearning={() => {
            setLearningUser(detailUser)
            setDetailUser(null)
          }}
        />
      )}

      {learningUser && (
        <LearningDetailModal
          userId={learningUser.id}
          userName={learningUser.displayName}
          onClose={() => setLearningUser(null)}
        />
      )}

      {showCreate && (
        <AdminCreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => reload({ silent: true })}
        />
      )}
    </div>
  )
}
