'use client'

import { Activity, AlertTriangle, BookOpen, Database, Loader2, TrendingUp, Users } from 'lucide-react'
import { motion } from 'framer-motion'
import AdminShell from '@/components/admin/AdminShell'
import useAdminData from '@/hooks/useAdminData'
import api from '@/lib/api'

type Overview = {
  userCount: number; teacherCount: number; studentCount: number
  classCount: number; quizCount: number; activeQuizCount: number
  avgQuizScore: number; totalWords: number; wordsWithMeaning: number
  wordsNeedingEnrichment: number
}

export default function AdminOverviewPage() {
  const { data: ov, loading, refreshing, error, lastSyncedAt, reload } =
    useAdminData<Overview | null>({
      initialData: null,
      errorMessage: 'Không thể tải tổng quan.',
      fetchData: async () => {
        const res = await api.get('/admin/reports/overview')
        return res.data as Overview
      },
    })

  const enrichPct = ov ? Math.round((ov.wordsWithMeaning / Math.max(ov.totalWords, 1)) * 100) : 0

  const cards = ov ? [
    {
      label: 'Tổng người dùng', value: ov.userCount.toLocaleString(),
      sub: `${ov.teacherCount} giáo viên · ${ov.studentCount} học sinh`,
      icon: Users, bg: '#EEF4FF', color: '#00305E',
    },
    {
      label: 'Lớp học', value: ov.classCount.toLocaleString(),
      sub: `${ov.quizCount} quiz · ${ov.activeQuizCount} đang chạy`,
      icon: BookOpen, bg: '#ECFDF5', color: '#10b981',
    },
    {
      label: 'Tổng từ vựng', value: ov.totalWords.toLocaleString(),
      sub: `${ov.wordsWithMeaning.toLocaleString()} có nghĩa (${enrichPct}%)`,
      icon: Database, bg: '#FFFBEB', color: '#f59e0b',
    },
    {
      label: 'Cần enrich', value: ov.wordsNeedingEnrichment.toLocaleString(),
      sub: 'Chưa có nghĩa tiếng Anh',
      icon: AlertTriangle, bg: '#FEF2F2', color: '#ef4444',
    },
    {
      label: 'Điểm quiz TB', value: ov.avgQuizScore ? ov.avgQuizScore.toFixed(1) : '—',
      sub: 'Trung bình tất cả phiên',
      icon: Activity, bg: '#F5F3FF', color: '#7c3aed',
    },
  ] : []

  return (
    <AdminShell title="Tổng quan" subtitle="Số liệu thực từ database"
      activeNav="overview" error={error} refreshing={refreshing}
      onRefresh={() => reload({ silent: true })} lastSyncedAt={lastSyncedAt}>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-[#94A3B8]">
          <Loader2 size={24} className="animate-spin mr-2" /> Đang tải...
        </div>
      ) : (
        <div className="space-y-5">
          {/* Metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {cards.map(({ label, value, sub, icon: Icon, bg, color }, i) => (
              <motion.div key={label}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="bg-white rounded-[16px] p-5 border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-[10px] flex items-center justify-center" style={{ backgroundColor: bg }}>
                    <Icon size={18} style={{ color }} />
                  </div>
                </div>
                <p className="text-[#0F172A] text-2xl font-extrabold">{value}</p>
                <p className="text-[#64748B] text-xs font-medium mt-0.5">{label}</p>
                <p className="text-[#94A3B8] text-xs mt-1">{sub}</p>
              </motion.div>
            ))}
          </div>

          {/* Vocabulary coverage bar */}
          {ov && (
            <div className="bg-white rounded-[16px] p-5 border border-[#E2E8F0] shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-[#0F172A]">Độ phủ nghĩa từ vựng</p>
                <span className="text-sm font-bold" style={{ color: enrichPct >= 80 ? '#10b981' : enrichPct >= 50 ? '#f59e0b' : '#ef4444' }}>
                  {enrichPct}%
                </span>
              </div>
              <div className="h-3 bg-[#F1F4F9] rounded-full overflow-hidden">
                <motion.div className="h-full rounded-full"
                  style={{ background: enrichPct >= 80 ? '#10b981' : enrichPct >= 50 ? '#f59e0b' : '#ef4444' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${enrichPct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }} />
              </div>
              <p className="text-[#94A3B8] text-xs mt-2">
                {ov.wordsWithMeaning.toLocaleString()} / {ov.totalWords.toLocaleString()} từ có nghĩa thực
                {ov.wordsNeedingEnrichment > 0 && (
                  <span className="text-amber-600 ml-2">· {ov.wordsNeedingEnrichment.toLocaleString()} từ cần enrich thêm</span>
                )}
              </p>
            </div>
          )}

          {/* Quick links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { href: '/admin/users', label: 'Quản lý người dùng', desc: 'Xem, phân quyền tài khoản', icon: Users, color: '#00305E' },
              { href: '/admin/vocabulary', label: 'Quản lý từ vựng', desc: 'Xem, enrich, reset từ vựng', icon: Database, color: '#f59e0b' },
              { href: '/admin/reports', label: 'Báo cáo & Telemetry', desc: 'API metrics, tiến độ học', icon: TrendingUp, color: '#10b981' },
            ].map(({ href, label, desc, icon: Icon, color }) => (
              <a key={href} href={href}
                className="bg-white rounded-[16px] p-5 border border-[#E2E8F0] shadow-sm hover:shadow-md hover:border-[#00305E]/20 transition-all flex items-center gap-4">
                <div className="w-11 h-11 rounded-[12px] flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: color + '15' }}>
                  <Icon size={20} style={{ color }} />
                </div>
                <div>
                  <p className="font-semibold text-[#0F172A] text-sm">{label}</p>
                  <p className="text-[#94A3B8] text-xs mt-0.5">{desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </AdminShell>
  )
}
