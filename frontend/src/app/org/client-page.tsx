'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Building2, Users, GraduationCap, Armchair, Sparkles, Activity, BarChart3 } from 'lucide-react'
import { OrgShell } from '@/components/layouts/OrgShell'
import { logout } from '@/lib/authSession'
import { httpStatus } from '@/lib/api'
import { toastApiError } from '@/lib/toastApiError'
import { useUserStore } from '@/stores/useUserStore'
import { getOrgSummary, getAnalytics } from '@/lib/orgApi'
import { useTracking } from '@/hooks/useTracking'
import { B2B_EVENT } from '@/lib/analytics/b2bEvents'

type OrgSummary = Awaited<ReturnType<typeof getOrgSummary>>
type OrgAnalytics = Awaited<ReturnType<typeof getAnalytics>>

export default function OrgDashboardClientPage() {
  const router = useRouter()
  const user = useUserStore((s) => s.user)
  const { trackEvent } = useTracking()

  const [summary, setSummary] = useState<OrgSummary | null>(null)
  const [analytics, setAnalytics] = useState<OrgAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [summaryData, analyticsData] = await Promise.all([
        getOrgSummary(),
        getAnalytics(),
      ])
      setSummary(summaryData)
      setAnalytics(analyticsData)
      trackEvent(B2B_EVENT.ORG_DASHBOARD_VIEWED, {
        seat_used: summaryData.seatUsed,
        seat_limit: summaryData.seatLimit,
        student_count: summaryData.studentCount,
        teacher_count: summaryData.teacherCount,
        plan_code: summaryData.planCode,
      })
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
  }, [router, trackEvent])

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

            {analytics && (
              <AnalyticsSection analytics={analytics} />
            )}
          </>
        )}
      </div>
    </OrgShell>
  )
}

function AnalyticsSection({ analytics }: { analytics: OrgAnalytics }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 px-1">
        <BarChart3 size={18} className="text-indigo-600" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Hoạt động & phân tích
        </h3>
      </div>

      {/* Metric tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricTile
          label="Học viên"
          value={analytics.studentCount}
          icon={<GraduationCap size={20} />}
          tint="amber"
        />
        <MetricTile
          label="Giáo viên"
          value={analytics.teacherCount}
          icon={<Users size={20} />}
          tint="blue"
        />
        <MetricTile
          label="Lớp học"
          value={analytics.classCount}
          icon={<Building2 size={20} />}
          tint="indigo"
        />
        <MetricTile
          label="HV hoạt động 7 ngày"
          value={analytics.activeStudents7d}
          icon={<Activity size={20} />}
          tint="emerald"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Tokens this month */}
        <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
          <div className="absolute right-4 top-4 text-indigo-200">
            <Sparkles size={40} />
          </div>
          <p className="mb-1 text-sm font-bold uppercase tracking-wider text-indigo-500">
            Token AI tháng này
          </p>
          <p className="text-4xl font-black text-slate-800">
            {analytics.tokensThisMonth.toLocaleString('vi-VN')}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Tổng token tiêu thụ bởi toàn bộ thành viên tổ chức trong tháng hiện tại.
          </p>
        </div>

        {/* CEFR distribution */}
        <CefrDistribution buckets={analytics.cefrDistribution} />
      </div>
    </div>
  )
}

function CefrDistribution({ buckets }: { buckets: OrgAnalytics['cefrDistribution'] }) {
  const maxCount = buckets.reduce((max, b) => Math.max(max, b.count), 0)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">
        Phân bố trình độ (CEFR)
      </p>
      {buckets.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          Chưa có dữ liệu trình độ học viên.
        </p>
      ) : (
        <div className="space-y-3">
          {buckets.map((bucket) => {
            const pct = maxCount > 0 ? Math.round((bucket.count / maxCount) * 100) : 0
            return (
              <div key={bucket.level} className="flex items-center gap-3">
                <span className="w-10 shrink-0 text-sm font-bold text-slate-700">
                  {bucket.level}
                </span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-purple-500 transition-all"
                    style={{ width: `${Math.max(pct, bucket.count > 0 ? 6 : 0)}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-sm font-semibold text-slate-500">
                  {bucket.count}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MetricTile({
  label,
  value,
  icon,
  tint,
}: {
  label: string
  value: number
  icon: React.ReactNode
  tint: 'blue' | 'amber' | 'indigo' | 'emerald'
}) {
  const tones: Record<typeof tint, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-600' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600' },
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
  }
  const t = tones[tint]
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${t.bg} ${t.text}`}>
        {icon}
      </div>
      <p className="text-3xl font-black leading-none text-slate-800">{value}</p>
      <p className="mt-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
    </div>
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
