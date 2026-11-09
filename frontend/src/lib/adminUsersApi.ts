import api from '@/lib/api'

/**
 * Danh bạ người dùng admin (đợt 1 "Nền móng + Người dùng", 09/11/2026).
 *
 * Bọc các endpoint của AdminUserDirectoryService (backend GĐ2): danh sách lọc/sắp xếp/phân trang
 * trên server, KPI đếm trên cả bảng, hồ sơ một người — cùng các thao tác nhạy cảm nay BẮT BUỘC lý
 * do (khoá tài khoản, đặt lại mật khẩu, cấp/bỏ ADMIN, đổi gói).
 *
 * Quy ước trang: URL và UI đánh số từ 1, API đánh số từ 0 — đổi ở đúng một chỗ là đây.
 */

export const ADMIN_ROLES = ['STUDENT', 'TEACHER', 'MANAGER', 'OWNER', 'ADMIN'] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

export type QuotaView = {
  kind: 'WALLET' | 'FREE_DAY' | 'INTERNAL_UNLIMITED' | 'NONE' | string
  unlimited: boolean
  monthlyTokenLimit: number
  remainingThisMonth: number
  walletBalance: number
  walletCap: number
  dailyTokenGrant: number
  usedToday: number
}

export type AdminUserRow = {
  id: number
  email: string
  displayName: string
  role: AdminRole
  isActive: boolean
  createdAt: string | null
  orgId: number | null
  orgName: string | null
  planCode: string
  usageLast30Days: number
  quota: QuotaView | null
}

export type UserSearchPage = {
  items: AdminUserRow[]
  total: number
  /** 0-based, như API trả. */
  page: number
  size: number
  sort: string
}

export type UserSearchParams = {
  q?: string
  role?: string
  status?: 'active' | 'locked' | ''
  plan?: string
  org?: string
  /** "field,dir" — createdAt | displayName | email | usage30d. */
  sort?: string
  /** 1-based (URL). */
  page: number
  size: number
}

export type TopUsageUser = {
  id: number
  email: string
  displayName: string
  role: AdminRole
  usageLast30Days: number
}

export type UserStats = {
  total: number
  active: number
  locked: number
  byRole: Record<AdminRole, number>
  aiActive30d: number
  freeTeachers: number
  topUsage30d: TopUsageUser[]
}

export type UserProfile = {
  id: number
  email: string
  displayName: string
  role: AdminRole
  isActive: boolean
  createdAt: string | null
  locale: string | null
  orgId: number | null
  orgName: string | null
  planCode: string
  subscriptionStartsAtUtc: string | null
  subscriptionEndsAtUtc: string | null
}

export type QuotaDetail = {
  planCode?: string
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
}

export type UsageRow = {
  id: number
  createdAt?: string
  feature?: string
  provider?: string
  model?: string
  totalTokens?: number
}

export type AuditItem = {
  id: number
  eventName: string
  actorEmail: string | null
  actorRole: string | null
  targetType: string | null
  targetId: string | null
  metadataJson: string | null
  createdAt: string | null
}

export type AuditPage = { items: AuditItem[]; total: number; page: number; size: number }

export type PlanRow = { code: string; name: string }

function clean<T extends Record<string, unknown>>(o: T): Partial<T> {
  const out: Partial<T> = {}
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined && v !== null && v !== '') (out as Record<string, unknown>)[k] = v
  }
  return out
}

export const adminUsersApi = {
  search(p: UserSearchParams) {
    return api.get<UserSearchPage>('/admin/users/search', {
      params: clean({ ...p, page: Math.max(0, p.page - 1) }),
    })
  },
  stats() {
    return api.get<UserStats>('/admin/users/stats')
  },
  profile(id: number) {
    return api.get<UserProfile>(`/admin/users/${id}`)
  },
  quota(id: number) {
    return api.get<QuotaDetail>(`/admin/users/${id}/quota`)
  },
  usage(id: number, limit = 200) {
    return api.get<UsageRow[]>(`/admin/users/${id}/usage`, { params: { limit } })
  },
  audit(targetUserId: number, page: number, size: number) {
    return api.get<AuditPage>('/admin/audit', { params: { targetUserId, page: Math.max(0, page - 1), size } })
  },
  plans() {
    return api.get<PlanRow[]>('/admin/plans')
  },
  setActive(id: number, active: boolean, reason?: string) {
    return api.patch(`/admin/users/${id}/active`, clean({ active, reason }))
  },
  setPassword(id: number, password: string, reason: string) {
    return api.patch(`/admin/users/${id}/password`, { password, reason })
  },
  setRole(id: number, role: string, reason?: string) {
    return api.patch(`/admin/users/${id}/role`, clean({ role, reason }))
  },
  setPlan(
    id: number,
    body: {
      planCode: string
      monthlyTokenLimitOverride: number | null
      startsAtUtc: string
      endsAtUtc: string | null
      reason: string
    },
  ) {
    return api.patch(`/admin/users/${id}/plan`, body)
  },
}
