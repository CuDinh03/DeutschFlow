'use client'

import { toast } from 'sonner'
import api from '@/lib/api'
import useAdminData from '@/hooks/useAdminData'
import { GaPageHdr, GaBtn, GaCap } from '@/components/ui-v2'

// ── Green header accent (plans screen overrides the admin-navy chrome) ────────
const GREEN = '#1E9E61'
const plansAccentVars = {
  '--ga-accent': GREEN,
  '--ga-hdr-bg': 'rgba(30,158,97,0.07)',
  '--ga-hdr-line': 'rgba(30,158,97,0.20)',
} as React.CSSProperties

// Per-tier accent bar (cycled by index, mirrors the proto's colour-per-plan).
const TIER_COLORS = ['#B3ADA5', '#FFCD00', '#1E9E61', '#7C56C8', '#2F6FC9', '#11888A']

// ── Normalized plan (listPlans aliases fold lower-case) ───────────────────────
interface AdminPlan {
  code: string
  name: string
  monthlyTokenLimit: number
  dailyTokenGrant: number
  walletCapDays: number
  isActive: boolean
}

function normalizePlan(r: Record<string, unknown>): AdminPlan {
  const pick = (...keys: string[]) => {
    for (const k of keys) if (r[k] !== undefined && r[k] !== null) return r[k]
    return undefined
  }
  const num = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return {
    code: String(pick('code') ?? ''),
    name: String(pick('name') ?? pick('code') ?? ''),
    monthlyTokenLimit: num(pick('monthlyTokenLimit', 'monthlytokenlimit')),
    dailyTokenGrant: num(pick('dailyTokenGrant', 'dailytokengrant')),
    walletCapDays: num(pick('walletCapDays', 'walletcapdays')),
    isActive: pick('isActive', 'isactive') !== false,
  }
}

// Plans are token-budget tiers (price lives in the payment provider, not stored
// here) → headline shows the token allowance instead of a currency price.
function allowance(p: AdminPlan): string {
  // INTERNAL uses a 999_999_999 sentinel for "unlimited".
  if (p.monthlyTokenLimit >= 999_000_000) return 'Không giới hạn'
  if (p.monthlyTokenLimit > 0) return `${p.monthlyTokenLimit.toLocaleString('vi-VN')} token/tháng`
  if (p.dailyTokenGrant > 0) return `${p.dailyTokenGrant.toLocaleString('vi-VN')} token/ngày`
  return '—'
}

export default function V2AdminPlansPage() {
  const { data, loading, error, reload } = useAdminData<AdminPlan[]>({
    initialData: [],
    errorMessage: 'Không thể tải danh sách gói.',
    fetchData: async () => {
      const res = await api.get('/admin/plans')
      return ((res.data ?? []) as Record<string, unknown>[]).map(normalizePlan)
    },
  })

  return (
    <div className="flex min-h-full flex-col" style={plansAccentVars}>
      <GaPageHdr
        accent
        title="Gói thuê bao"
        subtitle="Quản lý gói, hạn mức token và quyền lợi"
        right={
          <GaBtn variant="ghost" onClick={() => toast('Biểu mẫu tạo gói mới (sắp ra mắt)')}>
            + Tạo gói
          </GaBtn>
        }
      />

      <div className="flex-1 px-10 py-7">
        {loading ? (
          <div className="grid grid-cols-2 gap-[18px] sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="ga-shimmer h-[180px] border border-ga-line" aria-hidden />
            ))}
          </div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[26px] font-medium leading-[1.2] text-ga-red">
              Không tải được danh sách gói
            </h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14.5px] text-ga-muted">
              {error} <code className="font-mono text-[12px] text-ga-accent">GET /api/admin/plans</code>
            </p>
            <GaBtn variant="primary" onClick={() => reload({ silent: false })}>
              Thử lại
            </GaBtn>
          </div>
        ) : data.length === 0 ? (
          <div className="border border-dashed border-ga-line px-10 py-10 text-center">
            <p className="ga-ui text-[14.5px] text-ga-muted">Chưa có gói nào.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-[18px] sm:grid-cols-3 xl:grid-cols-4">
            {data.map((p, i) => (
              <div key={p.code} className="relative border border-ga-line bg-ga-card p-6">
                <div
                  className="absolute inset-x-0 top-0 h-[3px]"
                  style={{ background: TIER_COLORS[i % TIER_COLORS.length] }}
                />
                <div className="mb-3.5 flex items-center justify-between">
                  <GaCap>{p.name}</GaCap>
                  {!p.isActive && (
                    <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ga-subtle">
                      Tắt
                    </span>
                  )}
                </div>
                <div className="mb-1 break-words font-ga-display text-[24px] font-medium leading-tight text-ga-ink">
                  {allowance(p)}
                </div>
                <div className="mb-[18px] text-[13px] text-ga-muted">
                  {p.walletCapDays > 0 ? `Ví rollover ${p.walletCapDays} ngày` : 'Cấp theo ngày'}
                </div>
                <button
                  type="button"
                  onClick={() => toast(`Chỉnh sửa gói ${p.name}`)}
                  className="ga-ui w-full rounded-ga border border-ga-line py-[9px] text-[12.5px] font-semibold text-ga-ink transition-colors hover:border-ga-accent hover:text-ga-accent"
                >
                  Chỉnh sửa
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
