'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts'
import {
  BookOpen, Mic, BrainCircuit, Target, AlertCircle, ShieldAlert,
} from 'lucide-react'
import api from '@/lib/api'
import { clearTokens, getAccessToken } from '@/lib/authSession'
import { StudentShell } from '@/components/layouts/StudentShell'
import { AchievementBadges } from '@/components/analytics/AchievementBadges'
import { usePageTimeTracker } from '@/hooks/usePageTimeTracker'

// ─── Types ────────────────────────────────────────────────────────────────────

type Me = { displayName: string; role: string }

type DayStats = { date: string; wordsLearned: number; wordsReviewed: number; speakingMinutes: number }

type AnalyticsSummary = {
  totalWordsLearned: number
  totalWordsReviewed: number
  totalSpeakingMinutes: number
  totalSessionsCompleted: number
  wordsDueForReview: number
  weeklyBreakdown: DayStats[]
  errorsByType: Record<string, number>
  topWeakPoints: string[]
}

type RecommendationItem = {
  type: string
  title: string
  description: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  actionUrl: string
}

type Recommendations = { items: RecommendationItem[] }

type DailyErrorCount = { date: string; errorCount: number }

type ErrorAnalytics = {
  mostCommonErrors: Array<{ errorCode: string; label: string; count: number; severity: string }>
  errorTrend: DailyErrorCount[]
  totalErrorsThisWeek: number
  openErrors: number
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <span className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: color + '15', color }}>
          {icon}
        </span>
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <p className="text-3xl font-extrabold text-slate-900">{value}</p>
      {sub ? <p className="text-xs text-slate-400 mt-1">{sub}</p> : null}
    </div>
  )
}

function WeeklyChart({ data }: { data: DayStats[] }) {
  const formatted = data.map((d) => ({
    day: new Date(d.date).toLocaleDateString('de-DE', { weekday: 'short' }),
    Gelernt: d.wordsLearned,
    Wiederholt: d.wordsReviewed,
    Sprechen: d.speakingMinutes,
  }))

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-700 mb-4">Wöchentliche Aktivität</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={formatted} barSize={10} barGap={3}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ border: 'none', borderRadius: 12, fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
          <Bar dataKey="Gelernt" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Wiederholt" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Sprechen" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-3 justify-center">
        {[['#3b82f6', 'Neu gelernt'], ['#10b981', 'Wiederholt'], ['#f59e0b', 'Sprechen (min)']].map(([color, label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-[11px] text-slate-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ErrorChart({ errors }: { errors: Record<string, number> }) {
  const data = Object.entries(errors)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([code, count]) => ({
      name: code.split('.').pop()?.replace(/_/g, ' ') ?? code,
      Fehler: count,
    }))

  if (data.length === 0) return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm text-center py-10">
      <p className="text-slate-400 text-sm">Noch keine Fehler aufgezeichnet.</p>
    </div>
  )

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-700 mb-4">Häufige Fehler (7 Tage)</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} layout="vertical" barSize={12}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} width={90} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ border: 'none', borderRadius: 12, fontSize: 12 }} />
          <Bar dataKey="Fehler" fill="#ef4444" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ErrorTrendChart({ trend, openErrors }: { trend: DailyErrorCount[]; openErrors: number }) {
  const formatted = trend.map((d) => ({
    date: d.date.slice(5),
    Fehler: d.errorCount,
  }))

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-700">Fehlertrend (30 Tage)</h3>
        {openErrors > 0 ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full">
            <ShieldAlert size={12} />
            {openErrors} offen
          </span>
        ) : (
          <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">Alle behoben ✓</span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={formatted}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
            interval={Math.floor(formatted.length / 5)} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ border: 'none', borderRadius: 12, fontSize: 12 }} />
          <Line type="monotone" dataKey="Fehler" stroke="#ef4444" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function RecommendationsPanel({ items }: { items: RecommendationItem[] }) {
  const router = useRouter()
  const priorityColor = (p: string) =>
    p === 'HIGH' ? '#ef4444' : p === 'MEDIUM' ? '#f59e0b' : '#94a3b8'

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-700">Empfehlungen</h3>
      </div>
      <ul className="divide-y divide-slate-100">
        {items.map((item, i) => (
          <li key={i} className="px-5 py-4 flex items-start gap-3 hover:bg-slate-50 transition-colors cursor-pointer"
            onClick={() => router.push(item.actionUrl)}>
            <span className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0" style={{ background: priorityColor(item.priority), marginTop: 6 }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{item.title}</p>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{item.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StatsPage() {
  usePageTimeTracker('stats');
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null)
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([])
  const [errorAnalytics, setErrorAnalytics] = useState<ErrorAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getAccessToken()) { router.push('/login'); return }
    ;(async () => {
      try {
        const meRes = await api.get<Me>('/auth/me')
        setMe(meRes.data)
        const [analyticsRes, recRes, errAnalyticsRes] = await Promise.allSettled([
          api.get<AnalyticsSummary>('/user/analytics'),
          api.get<Recommendations>('/user/recommendations'),
          api.get<ErrorAnalytics>('/user/error-analytics'),
        ])
        if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value.data)
        if (recRes.status === 'fulfilled') setRecommendations(recRes.value.data.items ?? [])
        if (errAnalyticsRes.status === 'fulfilled') setErrorAnalytics(errAnalyticsRes.value.data)
      } finally {
        setLoading(false)
      }
    })()
  }, [router])

  const handleLogout = useCallback(() => { clearTokens(); router.push('/') }, [router])

  if (!me) return <div className="min-h-screen flex items-center justify-center"><p className="text-slate-400 text-sm">Laden…</p></div>

  const initials = me.displayName.split(' ').map((p) => p.charAt(0)).join('').slice(0, 2).toUpperCase()

  return (
    <StudentShell
      activeSection="progress"
      user={{ displayName: me.displayName, role: me.role }}
      targetLevel="A1"
      streakDays={0}
      initials={initials}
      onLogout={handleLogout}
      headerTitle="Meine Statistiken"
      headerSubtitle="Lernfortschritt der letzten 7 Tage"
    >
      <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : analytics ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={<BookOpen size={18} />} label="Neu gelernt" value={analytics.totalWordsLearned} sub="diese Woche" color="#3b82f6" />
              <StatCard icon={<BrainCircuit size={18} />} label="Wiederholt" value={analytics.totalWordsReviewed} sub="Wörter" color="#10b981" />
              <StatCard icon={<Mic size={18} />} label="Sprechen" value={`${analytics.totalSpeakingMinutes}min`} sub="diese Woche" color="#f59e0b" />
              <StatCard icon={<Target size={18} />} label="Fällig" value={analytics.wordsDueForReview} sub="zu wiederholen" color="#ef4444" />
            </div>

            <WeeklyChart data={analytics.weeklyBreakdown} />

            <div className="grid md:grid-cols-2 gap-5">
              <ErrorChart errors={analytics.errorsByType} />

              {analytics.topWeakPoints.length > 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <AlertCircle size={16} className="text-amber-500" />
                    Schwachpunkte
                  </h3>
                  <ul className="space-y-2">
                    {analytics.topWeakPoints.map((point, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-sm text-slate-700">
                        <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                        <span>{point.replace('.', ' → ').replace(/_/g, ' ')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            {errorAnalytics && errorAnalytics.errorTrend.length > 0 ? (
              <ErrorTrendChart trend={errorAnalytics.errorTrend} openErrors={errorAnalytics.openErrors} />
            ) : null}

            {recommendations.length > 0 ? <RecommendationsPanel items={recommendations} /> : null}
          </>
        ) : (
          <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center">
            <p className="text-slate-400 text-sm">Noch keine Statistiken verfügbar. Fang an zu lernen!</p>
          </div>
        )}

        <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Abzeichen</h3>
          <AchievementBadges limit={9} showLocked />
        </div>
      </div>
    </StudentShell>
  )
}
