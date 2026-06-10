'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Building2, Users, GraduationCap, Armchair } from 'lucide-react'
import { OrgShell } from '@/components/layouts/OrgShell'
import { logout } from '@/lib/authSession'
import { httpStatus } from '@/lib/api'
import { toastApiError } from '@/lib/toastApiError'
import { useUserStore } from '@/stores/useUserStore'
import { getOrgSummary } from '@/lib/orgApi'

type OrgSummary = Awaited<ReturnType<typeof getOrgSummary>>

export default function OrgDashboardClientPage() {
  const router = useRouter()
  const user = useUserStore((s) => s.user)

  const [summary, setSummary] = useState<OrgSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getOrgSummary()
      setSummary(data)
    } catch (e) {
      if (httpStatus(e) === 401) {
        router.push('/login')
        return
      }
      if (httpStatus(e) === 403) {
        router.push('/teacher/dashboard')
        return
      }
      setError('Không thể tải thông tin tổ chức. Vui lòng thử lại sau.')
      toastApiError(e, { onRetry: () => void load() })
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  const userName = user?.displayName || user?.email?.split('@')[0] || 'Quản trị viên'

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-indigo-600" />
          <p className="font-medium text-slate-500">Đang tải tổng quan tổ chức...</p>
        </div>
      </div>
    )
  }

  const seatLimit = summary?.seatLimit ?? 0
  const seatUsed = summary?.seatUsed ?? 0
  const seatPct = seatLimit > 0 ? Math.min(100, Math.round((seatUsed / seatLimit) * 100)) : 0
  const seatTone =
    seatLimit === 0 ? 'from-slate-400 to-slate-500' :
    seatPct >= 90 ? 'from-rose-500 to-red-500' :
    seatPct >= 70 ? 'from-amber-400 to-orange-500' :
    'from-emerald-400 to-teal-500'

  return (
    <OrgShell
      activeMenu="dashboard"
      userName={userName}
      onLogout={() => { void logout() }}
      headerTitle="Tổng quan tổ chức"
      headerSubtitle={summary?.name ?? 'Quản trị trung tâm đào tạo'}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              onClick={() => void load()}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
            >
              Thử lại
            </button>
          </div>
        )}

        {!summary ? (
          <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-50">
              <Building2 size={32} className="text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-700">Chưa có dữ liệu tổ chức</h3>
            <p className="mt-2 max-w-sm text-slate-500">
              Dữ liệu sẽ xuất hiện sau khi tổ chức của bạn được khởi tạo và có thành viên tham gia.
            </p>
          </div>
        ) : (
          <>
            {/* Org identity card */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 p-8 text-white shadow-xl">
              <div className="absolute right-0 top-0 -mr-10 -mt-10 opacity-10">
                <Building2 size={220} />
              </div>
              <div className="relative z-10">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-300">
                  <Building2 size={16} /> Trung tâm đào tạo
                </div>
                <h2 className="text-3xl font-black">{summary.name}</h2>
                {summary.planCode && (
                  <span className="mt-3 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-100">
                    Gói: {summary.planCode}
                  </span>
                )}
              </div>
            </div>

            {/* Counts */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <StatCard
                label="Giáo viên"
                value={summary.teacherCount ?? 0}
                icon={<Users size={24} />}
                tint="blue"
              />
              <StatCard
                label="Học viên"
                value={summary.studentCount ?? 0}
                icon={<GraduationCap size={24} />}
                tint="amber"
              />
            </div>

            {/* Seat usage */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-700">
                  <Armchair size={18} className="text-indigo-600" />
                  <span className="text-sm font-bold">Ghế học viên</span>
                </div>
                <span className="text-sm font-semibold text-slate-500">
                  {seatLimit > 0 ? (
                    <>
                      <span className="font-black text-slate-800">{seatUsed}</span> / {seatLimit}
                    </>
                  ) : (
                    <>
                      <span className="font-black text-slate-800">{seatUsed}</span> · chưa giới hạn
                    </>
                  )}
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${seatTone} transition-all`}
                  style={{ width: seatLimit > 0 ? `${seatPct}%` : '8%' }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {seatLimit > 0
                  ? `Đã sử dụng ${seatPct}% số ghế học viên của tổ chức.`
                  : 'Tổ chức chưa cấu hình giới hạn ghế. Liên hệ quản trị nền tảng để kích hoạt gói.'}
              </p>
            </div>
          </>
        )}
      </div>
    </OrgShell>
  )
}

function StatCard({
  label,
  value,
  icon,
  tint,
}: {
  label: string
  value: number
  icon: React.ReactNode
  tint: 'blue' | 'amber'
}) {
  const tones: Record<typeof tint, { bg: string; text: string; orb: string }> = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600', orb: 'bg-blue-50' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-600', orb: 'bg-amber-50' },
  }
  const t = tones[tint]
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
      <div className={`absolute right-0 top-0 -mr-4 -mt-4 h-24 w-24 rounded-full ${t.orb} opacity-50 transition-transform group-hover:scale-110`} />
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p className="mb-1 text-sm font-bold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="text-4xl font-black text-slate-800">{value}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl shadow-inner ${t.bg} ${t.text}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}
