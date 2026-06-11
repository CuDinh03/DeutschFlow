'use client'

import { useCallback, useEffect, useState } from 'react'
import { Mail, MessageCircle, Users, FileCheck2, Gauge, ExternalLink, Building2 } from 'lucide-react'
import AdminShell from '@/components/admin/AdminShell'
import { httpStatus } from '@/lib/api'
import { getGrowthStats, listLeads, getTeacherClusters, type GrowthStats, type MarketingLead, type TeacherCluster } from '@/lib/adminMarketingApi'

export default function AdminMarketingClientPage() {
  const [stats, setStats] = useState<GrowthStats | null>(null)
  const [leads, setLeads] = useState<MarketingLead[]>([])
  const [clusters, setClusters] = useState<TeacherCluster[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true)
    setError(undefined)
    try {
      const [s, l, c] = await Promise.all([getGrowthStats(), listLeads(30, 200), getTeacherClusters(3)])
      setStats(s)
      setLeads(l)
      setClusters(c)
      setLastSyncedAt(new Date())
    } catch (e) {
      if (httpStatus(e) === 403) {
        setError('Bạn không có quyền xem trang này.')
      } else {
        setError('Không tải được số liệu tăng trưởng. Vui lòng thử lại.')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <AdminShell
      title="Tăng trưởng (Leads)"
      subtitle="Phễu lead magnet & report chia sẻ — follow-up khách quan tâm"
      activeNav="marketing"
      error={error}
      refreshing={refreshing}
      onRefresh={() => void load(true)}
      lastSyncedAt={lastSyncedAt}
    >
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        {loading ? (
          <div className="py-20 text-center text-sm text-slate-400">Đang tải số liệu…</div>
        ) : (
          <>
            {/* Stat tiles */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile label="Lead (tổng)" value={stats?.leadsTotal ?? 0} sub={`+${stats?.leads7d ?? 0} trong 7 ngày`} icon={<Users size={18} />} tint="indigo" />
              <Tile label="Lead hôm nay" value={stats?.leadsToday ?? 0} sub="24 giờ qua" icon={<Users size={18} />} tint="emerald" />
              <Tile label="Lượt chấm thử" value={stats?.reportsTotal ?? 0} sub={`+${stats?.reports7d ?? 0} trong 7 ngày`} icon={<FileCheck2 size={18} />} tint="violet" />
              <Tile label="Điểm TB" value={stats?.avgScore ?? 0} sub="trên 100" icon={<Gauge size={18} />} tint="amber" />
            </div>

            {/* Contact split */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SplitCard icon={<Mail size={18} className="text-blue-600" />} label="Lead để lại Email" value={stats?.emailLeads ?? 0} total={stats?.leadsTotal ?? 0} tone="bg-blue-500" />
              <SplitCard icon={<MessageCircle size={18} className="text-sky-600" />} label="Lead để lại Zalo/ĐT" value={stats?.zaloLeads ?? 0} total={stats?.leadsTotal ?? 0} tone="bg-sky-500" />
            </div>

            {/* Recent leads */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-3">
                <h2 className="text-sm font-bold text-slate-800">Lead gần đây (30 ngày)</h2>
                <p className="text-xs text-slate-400">Liên hệ những người này để mời dùng / lên gói.</p>
              </div>
              {leads.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-slate-400">Chưa có lead nào.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Tên</th>
                        <th className="px-5 py-3">Liên hệ</th>
                        <th className="px-5 py-3 hidden md:table-cell">Chủ đề</th>
                        <th className="px-5 py-3">Điểm</th>
                        <th className="px-5 py-3 hidden sm:table-cell">Ngày</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {leads.map((l) => (
                        <tr key={l.id} className="hover:bg-slate-50/60">
                          <td className="px-5 py-3 font-semibold text-slate-800">{l.name || '—'}</td>
                          <td className="px-5 py-3">
                            <span className="font-medium text-slate-700">{l.contact}</span>
                            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{l.contactType}</span>
                          </td>
                          <td className="px-5 py-3 hidden max-w-[14rem] truncate text-slate-500 md:table-cell">{l.topic || '—'}</td>
                          <td className="px-5 py-3">
                            {l.score != null ? (
                              <span className="font-bold text-slate-800">{l.score}</span>
                            ) : (
                              <span className="text-xs font-semibold text-rose-500">AI lỗi</span>
                            )}
                          </td>
                          <td className="px-5 py-3 hidden text-xs text-slate-400 sm:table-cell">{formatDate(l.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Teacher clusters by center (D11 org-sales trigger) */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
                <Building2 size={18} className="text-emerald-600" />
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Cụm GV theo trung tâm (≥3 GV tự do)</h2>
                  <p className="text-xs text-slate-400">Trung tâm có nhiều giáo viên tự do dùng app → cơ hội chào gói tổ chức (B2B).</p>
                </div>
              </div>
              {clusters.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-slate-400">
                  Chưa có cụm nào (cần ≥3 GV tự do khai cùng một trung tâm).
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Trung tâm</th>
                        <th className="px-5 py-3">Số GV</th>
                        <th className="px-5 py-3">Email liên hệ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {clusters.map((c) => (
                        <tr key={c.centerName} className="hover:bg-slate-50/60">
                          <td className="px-5 py-3 font-semibold text-slate-800">{c.centerName}</td>
                          <td className="px-5 py-3">
                            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">{c.teacherCount} GV</span>
                          </td>
                          <td className="px-5 py-3 text-xs text-slate-500">{c.contactEmails}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <a href="/free-grade" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
              Mở trang chấm thử (lead magnet) <ExternalLink size={14} />
            </a>
          </>
        )}
      </div>
    </AdminShell>
  )
}

const TINTS: Record<string, { bg: string; text: string }> = {
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
  violet: { bg: 'bg-violet-100', text: 'text-violet-600' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-600' },
}

function Tile({ label, value, sub, icon, tint }: { label: string; value: number; sub: string; icon: React.ReactNode; tint: keyof typeof TINTS }) {
  const t = TINTS[tint]
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${t.bg} ${t.text}`}>{icon}</div>
      <p className="text-3xl font-black leading-none text-slate-800">{value.toLocaleString('vi-VN')}</p>
      <p className="mt-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
    </div>
  )
}

function SplitCard({ icon, label, value, total, tone }: { icon: React.ReactNode; label: string; value: number; total: number; tone: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">{icon} {label}</div>
        <span className="text-sm font-black text-slate-800">{value}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-slate-400">{pct}% tổng lead</p>
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
