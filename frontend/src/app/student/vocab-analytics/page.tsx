'use client'
import { logout } from '@/lib/authSession'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart2, TrendingUp, Loader2, RefreshCw, BookOpen } from 'lucide-react'
import { StudentShell } from '@/components/layouts/StudentShell'
import { useStudentPracticeSession } from '@/hooks/useStudentPracticeSession'
import api from '@/lib/api'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CoverageData {
  date: string
  totalWords: number
  nounWords: number
  nounWithGender: number
  nounDer: number
  nounDie: number
  nounDas: number
  nounCoveragePercent: number
  verbWords: number
  verbRows: number
  verbCoveragePercent: number
}

interface CoverageHistoryPoint {
  date: string
  totalWords: number
  nounCoveragePercent: number
  verbCoveragePercent: number
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<string, string> = {
  A1: '#22C55E', A2: '#3B82F6', B1: '#F59E0B', B2: '#8B5CF6', C1: '#EF4444', C2: '#EC4899',
}

// ─── SVG Bar Chart ────────────────────────────────────────────────────────────

function BarChart({ data }: { data: Record<string, { total: number; withMeaning: number }> }) {
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const maxTotal = Math.max(...levels.map(l => data[l]?.total ?? 0), 1)

  return (
    <div className="flex items-end gap-3 h-40 pt-4">
      {levels.map(lvl => {
        const item = data[lvl] ?? { total: 0, withMeaning: 0 }
        const totalH = (item.total / maxTotal) * 120
        const covH = item.total > 0 ? (item.withMeaning / item.total) * totalH : 0
        const pct = item.total > 0 ? Math.round((item.withMeaning / item.total) * 100) : 0
        const color = LEVEL_COLORS[lvl] ?? '#94A3B8'

        return (
          <div key={lvl} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold text-[#64748B]">{pct}%</span>
            <div className="relative w-full flex flex-col justify-end" style={{ height: 120 }}>
              {/* Background bar */}
              <div
                className="w-full rounded-t-lg bg-slate-100"
                style={{ height: Math.max(totalH, 4) }}
              />
              {/* Coverage bar overlay */}
              <motion.div
                className="absolute bottom-0 w-full rounded-t-lg"
                style={{ background: color, opacity: 0.85 }}
                initial={{ height: 0 }}
                animate={{ height: Math.max(covH, 2) }}
                transition={{ duration: 0.6, delay: 0.1 }}
              />
            </div>
            <span className="text-[11px] font-bold" style={{ color }}>{lvl}</span>
            <span className="text-[9px] text-[#94A3B8]">{item.total}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── SVG Line Chart ───────────────────────────────────────────────────────────

function LineChart({ data }: { data: CoverageHistoryPoint[] }) {
  if (!data || data.length < 2) {
    return <p className="text-sm text-[#94A3B8] text-center py-8">Chưa đủ dữ liệu lịch sử.</p>
  }

  const W = 300, H = 100, PAD = 16
  const maxPct = Math.max(...data.map(d => d.nounCoveragePercent), 100)
  const minPct = Math.min(...data.map(d => d.nounCoveragePercent), 0)
  const range = maxPct - minPct || 1

  const pts = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((d.nounCoveragePercent - minPct) / range) * (H - PAD * 2)
    return [x, y] as [number, number]
  })

  const path = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ')
  const area = `${path} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28">
      <defs>
        <linearGradient id="lgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366F1" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#lgrad)" />
      <path d={path} stroke="#6366F1" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill="#6366F1" />
      ))}
    </svg>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VocabAnalyticsPage() {
  const { me, loading: sessionLoading, targetLevel, streakDays, initials } = useStudentPracticeSession()

  const [coverage, setCoverage] = useState<CoverageData | null>(null)
  const [history, setHistory] = useState<CoverageHistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [covRes, histRes] = await Promise.allSettled([
        api.get<CoverageData>('/words/coverage'),
        api.get<CoverageHistoryPoint[]>('/words/coverage/history'),
      ])
      if (covRes.status === 'fulfilled') setCoverage(covRes.value.data)
      if (histRes.status === 'fulfilled') {
        const raw = histRes.value.data
        setHistory(Array.isArray(raw) ? raw : [])
      }
    } catch {
      setError('Không thể tải dữ liệu thống kê.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  if (sessionLoading || !me) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F1F4F9]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-4 border-[#121212] border-t-transparent rounded-full"
        />
      </div>
    )
  }

  const nounPct = coverage ? Math.round(coverage.nounCoveragePercent) : 0
  const verbPct = coverage ? Math.round(coverage.verbCoveragePercent) : 0
  const globalPct = coverage && coverage.totalWords > 0
    ? Math.round(((coverage.nounWithGender + coverage.verbRows) / (coverage.nounWords + coverage.verbWords)) * 100)
    : 0

  return (
    <StudentShell
      activeSection="vocab-analytics"
      user={me}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={() => { logout() }}
      headerTitle="Thống kê từ vựng"
      headerSubtitle="Phân tích độ phủ từ vựng theo cấp độ CEFR"
    >
      <div className="max-w-xl mx-auto space-y-5">

        {loading && (
          <div className="flex items-center justify-center py-16 gap-3 text-[#64748B]">
            <Loader2 size={22} className="animate-spin text-[#121212]" />
            <span>Đang phân tích từ vựng...</span>
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-10">
            <p className="text-sm text-red-500 mb-4">{error}</p>
            <button type="button" onClick={fetchData} className="px-4 py-2 bg-[#121212] text-white rounded-xl font-bold text-sm">Thử lại</button>
          </div>
        )}

        {!loading && !error && coverage && (
          <>
            {/* Global coverage card */}
            <div className="bg-gradient-to-br from-[#121212] to-[#1E4D8C] rounded-3xl p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <BookOpen size={22} className="text-[#FFCD00]" />
                  <div>
                    <h2 className="font-extrabold text-lg">Độ phủ từ vựng</h2>
                    <p className="text-white/60 text-xs">{coverage.totalWords.toLocaleString()} từ trong hệ thống</p>
                  </div>
                </div>
                <button type="button" onClick={fetchData} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all">
                  <RefreshCw size={14} />
                </button>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="bg-white/10 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-black text-[#FFCD00]">{Math.round(coverage.nounCoveragePercent)}%</p>
                  <p className="text-white/70 text-xs mt-1">Danh từ có giống</p>
                  <p className="text-white/40 text-[10px]">{coverage.nounWithGender.toLocaleString()} / {coverage.nounWords.toLocaleString()}</p>
                </div>
                <div className="bg-white/10 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-black text-[#FFCD00]">{Math.round(coverage.verbCoveragePercent)}%</p>
                  <p className="text-white/70 text-xs mt-1">Động từ có chia</p>
                  <p className="text-white/40 text-[10px]">{coverage.verbRows.toLocaleString()} / {coverage.verbWords.toLocaleString()}</p>
                </div>
              </div>

              {/* Giống der/die/das */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                {[['der', coverage.nounDer, '#60A5FA'], ['die', coverage.nounDie, '#F472B6'], ['das', coverage.nounDas, '#34D399']].map(([g, count, color]) => (
                  <div key={String(g)} className="bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-lg font-black" style={{ color: String(color) }}>{Number(count).toLocaleString()}</p>
                    <p className="text-white/50 text-xs">{g}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Bar chart & breakdown — replaced with noun/verb data */}
            <div className="bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={18} className="text-[#6366F1]" />
                <h3 className="font-bold text-[#0F172A]">Chi tiết từ vựng</h3>
              </div>
              <div className="space-y-4">
                {[
                  { label: 'Danh từ (Nomen)', pct: Math.round(coverage.nounCoveragePercent), count: `${coverage.nounWithGender.toLocaleString()} / ${coverage.nounWords.toLocaleString()}`, color: '#6366F1' },
                  { label: 'Động từ (Verben)', pct: Math.round(coverage.verbCoveragePercent), count: `${coverage.verbRows.toLocaleString()} / ${coverage.verbWords.toLocaleString()}`, color: '#F59E0B' },
                ].map(({ label, pct, count, color }) => (
                  <div key={label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-bold text-[#374151]">{label}</span>
                      <span className="text-xs text-[#64748B]">{count} từ ({pct}%)</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Line chart — history */}
            {history.length >= 2 && (
              <div className="bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={18} className="text-[#6366F1]" />
                  <h3 className="font-bold text-[#0F172A]">Lịch sử danh từ</h3>
                </div>
                <LineChart data={history} />
                <p className="text-[10px] text-[#94A3B8] text-center mt-2">
                  % danh từ có giống theo thời gian
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </StudentShell>
  )
}
