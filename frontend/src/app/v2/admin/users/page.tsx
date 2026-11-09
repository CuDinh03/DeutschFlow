'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { UserPlus } from 'lucide-react'
import { apiMessage } from '@/lib/api'
import {
  ADMIN_ROLES,
  adminUsersApi,
  type AdminRole,
  type AdminUserRow,
  type PlanRow,
  type UserSearchPage,
  type UserStats,
} from '@/lib/adminUsersApi'
import {
  GaPageHdr,
  GaBtn,
  TkSearch,
  TkSeg,
  DataTable,
  GaStatStrip,
  FilterChips,
  LoadingState,
  type DataTableColumn,
} from '@/components/ui-v2'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { defineFilters } from '@/lib/urlFilters'
import { useFmt } from '@/lib/i18n/useFmt'
import { AdminCreateUserModal } from './AdminCreateUserModal'

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

const PAGE_SIZE = 20

/**
 * Bộ lọc trên URL (đợt 1 "Nền móng + Người dùng", 09/11/2026): reload, Back hay gửi link đều giữ
 * nguyên "vai MANAGER · trang 2". `view=free-teachers` thay cho trang /v2/admin/free-teachers cũ
 * (route đó chuyển hướng về đây) — cùng định nghĩa với backend: TEACHER, không thuộc trung tâm, đang hoạt động.
 */
const FILTERS = defineFilters({
  q: { kind: 'string', default: '' },
  role: { kind: 'enum', values: ['all', ...ADMIN_ROLES] as const, default: 'all' },
  status: { kind: 'enum', values: ['all', 'active', 'locked'] as const, default: 'all' },
  plan: { kind: 'string', default: '' },
  sort: {
    kind: 'enum',
    values: [
      'createdAt,desc', 'createdAt,asc',
      'displayName,asc', 'displayName,desc',
      'email,asc', 'email,desc',
      'usage30d,desc', 'usage30d,asc',
    ] as const,
    default: 'createdAt,desc',
  },
  page: { kind: 'int', min: 1, max: 100000, default: 1 },
  view: { kind: 'enum', values: ['all', 'free-teachers'] as const, default: 'all' },
})

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

/** % hạn mức AI đã dùng trong cửa sổ hiện tại (used = limit − remaining). */
function quotaPercent(u: AdminUserRow): number | null {
  const q = u.quota
  if (!q || q.unlimited || q.monthlyTokenLimit <= 0) return null
  const used = Math.max(0, q.monthlyTokenLimit - q.remainingThisMonth)
  return Math.min(100, Math.round((used / q.monthlyTokenLimit) * 100))
}

export default function V2AdminUsersPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <V2AdminUsersPageInner />
    </Suspense>
  )
}

function V2AdminUsersPageInner() {
  const t = useTranslations('v2.adminOps.users')
  const fmt = useFmt()
  const router = useRouter()
  const { values, set } = useUrlFilters(FILTERS)
  const freeView = values.view === 'free-teachers'

  // Chữ đang gõ giữ cục bộ, đẩy lên URL sau 300ms — không bắn một truy vấn mỗi phím.
  const [qInput, setQInput] = useState(values.q)
  useEffect(() => setQInput(values.q), [values.q])
  useEffect(() => {
    if (qInput === values.q) return
    const h = setTimeout(() => set({ q: qInput }), 300)
    return () => clearTimeout(h)
  }, [qInput, values.q, set])

  const [page, setPage] = useState<UserSearchPage | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    adminUsersApi
      .search({
        q: values.q,
        role: freeView ? 'TEACHER' : values.role === 'all' ? '' : values.role,
        status: freeView ? 'active' : values.status === 'all' ? '' : (values.status as 'active' | 'locked'),
        plan: values.plan,
        org: freeView ? 'none' : '',
        sort: values.sort,
        page: values.page,
        size: PAGE_SIZE,
      })
      .then((r) => !cancelled && setPage(r.data))
      .catch((e) => !cancelled && setError(apiMessage(e) || t('loadError')))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [values.q, values.role, values.status, values.plan, values.sort, values.page, freeView, nonce, t])

  useEffect(() => {
    let cancelled = false
    adminUsersApi
      .stats()
      .then((r) => !cancelled && setStats(r.data))
      .catch(() => {})
    adminUsersApi
      .plans()
      .then((r) => !cancelled && setPlans(r.data ?? []))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [nonce])

  const [sortKey, sortDir] = values.sort.split(',') as [string, 'asc' | 'desc']
  const byRole = stats?.byRole

  const columns: DataTableColumn<AdminUserRow>[] = [
    {
      key: 'displayName',
      header: t('col.account'),
      sortable: true,
      render: (u) => {
        const tint = ROLE_TINT[u.role] ?? ROLE_TINT.STUDENT
        return (
          <div className="flex items-center gap-3">
            <span
              className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-[13px] font-bold"
              style={{ background: tint.s, color: tint.c }}
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
      header: t('col.role'),
      render: (u) => {
        const tint = ROLE_TINT[u.role] ?? ROLE_TINT.STUDENT
        return (
          <span
            className="inline-block rounded-ga px-[9px] py-1 text-[10px] font-bold tracking-[0.06em]"
            style={{ background: tint.s, color: tint.c }}
          >
            {u.role}
          </span>
        )
      },
    },
    {
      key: 'plan',
      header: t('col.plan'),
      render: (u) => <span className="text-[13.5px] text-ga-ink">{u.planCode || '—'}</span>,
    },
    {
      key: 'quota',
      header: t('col.quota'),
      render: (u) => {
        if (u.quota?.unlimited) return <span className="text-[12px] text-ga-subtle">{t('unlimited')}</span>
        const pct = quotaPercent(u)
        if (pct == null) return <span className="text-[12px] text-ga-subtle">—</span>
        return (
          <div className="pr-[18px]">
            <div className="h-[5px] overflow-hidden rounded-[3px] bg-ga-border">
              <div
                className="h-full rounded-[3px] transition-[width]"
                style={{ width: `${pct}%`, background: quotaColor(pct) }}
              />
            </div>
            <p className="mt-1 text-[11px] text-ga-muted">{t('quotaUsed', { pct })}</p>
          </div>
        )
      },
    },
    {
      key: 'usage30d',
      header: t('col.usage30d'),
      align: 'right',
      sortable: true,
      render: (u) => <span className="ga-ui tabular-nums text-ga-small">{fmt.num(u.usageLast30Days)}</span>,
    },
    {
      key: 'status',
      header: t('col.status'),
      render: (u) => (
        <span
          className="ga-ui inline-flex items-center gap-1.5 text-[12.5px]"
          style={{ color: u.isActive ? 'var(--ga-green)' : 'var(--ga-muted)' }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: u.isActive ? 'var(--ga-green)' : 'var(--ga-subtle)' }}
          />
          {u.isActive ? t('statusActive') : t('statusPaused')}
        </span>
      ),
    },
  ]

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <>
            <TkSearch
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              containerClassName="w-full sm:w-[230px]"
            />
            <GaBtn variant="yellow" onClick={() => setShowCreate(true)}>
              <UserPlus size={16} aria-hidden />
              {t('addUser')}
            </GaBtn>
          </>
        }
      />

      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        {/* KPI đếm trên CẢ bảng (GET /admin/users/stats), không trên trang đang xem. */}
        <GaStatStrip
          className="mb-[22px]"
          items={[
            { label: t('stats.totalUsers'), value: stats?.total ?? '—', tone: 'navy' },
            { label: t('stats.students'), value: byRole?.STUDENT ?? '—', tone: 'blue' },
            { label: t('stats.teachers'), value: byRole?.TEACHER ?? '—', tone: 'violet' },
            {
              label: t('stats.paused'),
              value: stats?.locked ?? '—',
              tone: 'orange',
              sub: (stats?.locked ?? 0) > 0 ? t('stats.pausedReview') : t('stats.pausedNone'),
              alert: (stats?.locked ?? 0) > 0,
            },
          ]}
        />

        <div className="mb-4">
          <TkSeg
            aria-label={t('view.label')}
            value={values.view}
            onValueChange={(v) => set({ view: v })}
            options={[
              { value: 'all', label: t('view.all') },
              {
                value: 'free-teachers',
                label: stats ? t('view.freeTeachersCount', { count: stats.freeTeachers }) : t('view.freeTeachers'),
              },
            ]}
          />
        </div>

        {freeView ? (
          <p className="ga-ui mb-[18px] text-ga-small text-ga-muted">{t('view.freeTeachersHint')}</p>
        ) : (
          <div className="mb-[18px] flex flex-col gap-3">
            <FilterChips
              ariaLabel={t('filters.roleLabel')}
              testIdPrefix="role-filter"
              value={values.role}
              onChange={(v) => set({ role: v })}
              options={[
                { value: 'all', label: t('filterAll'), count: stats?.total },
                ...ADMIN_ROLES.map((r: AdminRole) => ({ value: r, label: r, count: byRole?.[r] })),
              ]}
            />
            <div className="flex flex-wrap items-center gap-3">
              <FilterChips
                ariaLabel={t('filters.statusLabel')}
                testIdPrefix="status-filter"
                value={values.status}
                onChange={(v) => set({ status: v })}
                options={[
                  { value: 'all', label: t('filters.status.all') },
                  { value: 'active', label: t('filters.status.active'), count: stats?.active },
                  { value: 'locked', label: t('filters.status.locked'), count: stats?.locked },
                ]}
              />
              <select
                value={values.plan}
                onChange={(e) => set({ plan: e.target.value })}
                aria-label={t('filters.planLabel')}
                data-testid="plan-filter"
                className="ga-ui min-h-[40px] rounded-ga border border-ga-border bg-ga-card px-3 text-ga-caption font-semibold text-ga-ink lg:min-h-0 lg:py-2"
              >
                <option value="">{t('filters.planAll')}</option>
                <option value="DEFAULT">DEFAULT</option>
                {plans
                  .filter((p) => p.code !== 'DEFAULT')
                  .map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.code}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        )}

        <DataTable
          columns={columns}
          data={page?.items ?? []}
          rowKey={(u) => u.id}
          loading={loading}
          keepPreviousRows
          error={error}
          onRetry={() => setNonce((n) => n + 1)}
          errorEndpoint="GET /api/admin/users/search"
          itemNoun={t('itemNoun')}
          rowClassName={(u) => (!u.isActive ? 'opacity-60' : undefined)}
          onRowClick={(u) => router.push(`/v2/admin/users/${u.id}`)}
          rowActionLabel={(u) => t('openProfile', { name: u.displayName || u.email })}
          server={{
            total: page?.total ?? 0,
            page: values.page,
            pageSize: PAGE_SIZE,
            sortKey,
            sortDir,
            onPageChange: (p) => set({ page: p }),
            onSortChange: (key, dir) => set({ sort: `${key},${dir}` }),
          }}
          empty={
            <div className="px-4 py-5 text-center sm:px-6 lg:px-10 lg:py-7">
              <p className="ga-ui text-[14.5px] text-ga-muted">{t('empty')}</p>
            </div>
          }
        />
      </div>

      {showCreate && (
        <AdminCreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => setNonce((n) => n + 1)}
        />
      )}
    </div>
  )
}
