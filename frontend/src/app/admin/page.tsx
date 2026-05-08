'use client'

import {
  Activity,
  AlertTriangle,
  BookOpen,
  Bot,
  Coins,
  Database,
  LineChart,
  Loader2,
  PieChart,
  Settings,
  TrendingUp,
  Users,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('adminOverview')
  const { data: ov, loading, refreshing, error, lastSyncedAt, reload } =
    useAdminData<Overview | null>({
      initialData: null,
      errorMessage: t('error'),
      fetchData: async () => {
        const res = await api.get('/admin/reports/overview', { timeout: 8000 })
        return res.data as Overview
      },
    })

  const enrichPct = ov ? Math.round((ov.wordsWithMeaning / Math.max(ov.totalWords, 1)) * 100) : 0

  const cards = ov ? [
    {
      label: t('cardUsers'), value: ov.userCount.toLocaleString(),
      sub: t('cardUsersSub', { teachers: ov.teacherCount, students: ov.studentCount }),
      icon: Users, bg: '#EEF4FF', color: '#121212',
    },
    {
      label: t('cardClasses'), value: ov.classCount.toLocaleString(),
      sub: t('cardClassesSub', { quizzes: ov.quizCount, active: ov.activeQuizCount }),
      icon: BookOpen, bg: '#ECFDF5', color: '#10b981',
    },
    {
      label: t('cardWords'), value: ov.totalWords.toLocaleString(),
      sub: t('cardWordsSub', { withMeaning: ov.wordsWithMeaning.toLocaleString(), pct: enrichPct }),
      icon: Database, bg: '#FFFBEB', color: '#f59e0b',
    },
    {
      label: t('cardEnrich'), value: ov.wordsNeedingEnrichment.toLocaleString(),
      sub: t('cardEnrichSub'),
      icon: AlertTriangle, bg: '#FEF2F2', color: '#ef4444',
    },
    {
      label: t('cardQuiz'), value: ov.avgQuizScore ? ov.avgQuizScore.toFixed(1) : '—',
      sub: t('cardQuizSub'),
      icon: Activity, bg: '#F5F3FF', color: '#7c3aed',
    },
  ] : []

  return (
    <AdminShell title={t('title')} subtitle={t('subtitle')}
      activeNav="overview" error={error} refreshing={refreshing}
      onRefresh={() => reload({ silent: true })} lastSyncedAt={lastSyncedAt}>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-[#94A3B8]">
          <Loader2 size={24} className="animate-spin mr-2" /> {t('loading')}
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
                <p className="text-sm font-semibold text-[#0F172A]">{t('coverageTitle')}</p>
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
                {t('coverageLine', { withMeaning: ov.wordsWithMeaning.toLocaleString(), total: ov.totalWords.toLocaleString() })}
                {ov.wordsNeedingEnrichment > 0 && (
                  <span className="text-amber-600 ml-2">{t('coverageNeed', { n: ov.wordsNeedingEnrichment.toLocaleString() })}</span>
                )}
              </p>
            </div>
          )}

          {/* Quick links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { href: '/admin/users', label: t('linkUsers'), desc: t('linkUsersDesc'), icon: Users, color: '#121212' },
              { href: '/admin/plans', label: t('linkPlans'), desc: t('linkPlansDesc'), icon: Coins, color: '#0ea5e9' },
              { href: '/admin/revenue', label: t('linkRevenue'), desc: t('linkRevenueDesc'), icon: LineChart, color: '#6366f1' },
              { href: '/admin/token-analytics', label: t('linkTokens'), desc: t('linkTokensDesc'), icon: PieChart, color: '#f43f5e' },
              { href: '/admin/vocabulary', label: t('linkVocab'), desc: t('linkVocabDesc'), icon: Database, color: '#f59e0b' },
              { href: '/admin/reports', label: t('linkReports'), desc: t('linkReportsDesc'), icon: TrendingUp, color: '#10b981' },
              { href: '/admin/ai-config', label: t('linkAi'), desc: t('linkAiDesc'), icon: Bot, color: '#8b5cf6' },
              { href: '/admin/settings', label: t('linkSettings'), desc: t('linkSettingsDesc'), icon: Settings, color: '#64748B' },
            ].map(({ href, label, desc, icon: Icon, color }) => (
              <a key={href} href={href}
                className="bg-white rounded-[16px] p-5 border border-[#E2E8F0] shadow-sm hover:shadow-md hover:border-[#121212]/20 transition-all flex items-center gap-4">
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
