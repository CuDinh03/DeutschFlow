'use client'

import AdminShell from '@/components/admin/AdminShell'
import useAdminData from '@/hooks/useAdminData'
import api from '@/lib/api'

type PlanRow = {
  code: string
  name: string
  monthlyTokenLimit: number
  isActive: boolean
  featuresJson?: string
  createdAt?: string
}

export default function AdminPlansPage() {
  const { data, loading, refreshing, error, lastSyncedAt, reload } = useAdminData<PlanRow[]>({
    initialData: [],
    errorMessage: 'Không thể tải danh sách gói.',
    fetchData: async () => {
      const res = await api.get('/admin/plans')
      return (res.data ?? []) as PlanRow[]
    },
  })

  if (loading) {
    return (
      <AdminShell
        title="Gói đăng ký & hạn mức token"
        subtitle="Dữ liệu từ bảng subscription_plans"
        activeNav="plans"
        error={error}
        refreshing={refreshing}
        onRefresh={() => reload({ silent: true })}
        lastSyncedAt={lastSyncedAt}
      >
        <div className="text-muted-foreground text-sm">Đang tải…</div>
      </AdminShell>
    )
  }

  return (
    <AdminShell
      title="Gói đăng ký & hạn mức token"
      subtitle="Đổi gói cho từng user tại mục Người dùng · Chi tiết quota"
      activeNav="plans"
      error={error}
      refreshing={refreshing}
      onRefresh={() => reload({ silent: true })}
      lastSyncedAt={lastSyncedAt}
    >
      <div className="section-card rounded-[14px] border border-[#E2E8F0] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F8FAFC] text-left text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                <th className="px-4 py-3">Mã</th>
                <th className="px-4 py-3">Tên</th>
                <th className="px-4 py-3">Token / tháng (UTC)</th>
                <th className="px-4 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Không có gói nào.
                  </td>
                </tr>
              ) : (
                data.map((p) => (
                  <tr key={p.code} className="border-t border-[#E2E8F0] hover:bg-[#FAFBFC]">
                    <td className="px-4 py-3 font-mono font-semibold text-[#00305E]">{p.code}</td>
                    <td className="px-4 py-3 text-foreground">{p.name}</td>
                    <td className="px-4 py-3">{Number(p.monthlyTokenLimit ?? 0).toLocaleString('vi-VN')}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          p.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {p.isActive ? 'Đang dùng' : 'Tắt'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground px-4 py-3 border-t border-[#E2E8F0]">
          API: <code className="font-mono">GET /api/admin/plans</code>
        </p>
      </div>
    </AdminShell>
  )
}
