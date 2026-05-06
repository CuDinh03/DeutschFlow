'use client'
import { logout } from '@/lib/authSession'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Loader2, RefreshCw, Crown, Medal, Star, Zap } from 'lucide-react'
import { StudentShell } from '@/components/layouts/StudentShell'
import { useStudentPracticeSession } from '@/hooks/useStudentPracticeSession'
import { xpApi, type LeaderboardEntry } from '@/lib/xpApi'
import api from '@/lib/api'

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown size={20} className="text-yellow-400" />
  if (rank === 2) return <Medal size={18} className="text-slate-400" />
  if (rank === 3) return <Medal size={18} className="text-amber-600" />
  return <span className="text-sm font-bold text-[#94A3B8] w-5 text-center">{rank}</span>
}

function LevelBadge({ level }: { level: number }) {
  const colors: [string, string][] = [
    ['#E0E7FF','#4F46E5'], ['#F0FDF4','#16A34A'], ['#FEF9C3','#CA8A04'],
    ['#FEE2E2','#DC2626'], ['#F5F3FF','#7C3AED'],
  ]
  const [bg, text] = colors[Math.min(Math.floor((level - 1) / 5), colors.length - 1)]
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: bg, color: text }}>
      Lv.{level}
    </span>
  )
}

export default function LeaderboardPage() {
  const { me, loading: sessionLoading, targetLevel, streakDays, initials } = useStudentPracticeSession()
  const [board, setBoard] = useState<LeaderboardEntry[]>([])
  const [myUserId, setMyUserId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBoard = async () => {
    setLoading(true)
    setError(null)
    try {
      const [boardData, meData] = await Promise.all([
        xpApi.getLeaderboard(20),
        api.get<{ id: number }>('/auth/me').then(r => r.data),
      ])
      setBoard(boardData)
      setMyUserId(meData?.id ?? null)
    } catch {
      setError('Không thể tải bảng xếp hạng.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBoard() }, [])

  if (sessionLoading || !me) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F1F4F9]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-4 border-[#00305E] border-t-transparent rounded-full"
        />
      </div>
    )
  }

  const myEntry = board.find(e => e.userId === myUserId)

  return (
    <StudentShell
      activeSection="leaderboard"
      user={me}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={() => { logout() }}
      headerTitle="Bảng xếp hạng"
      headerSubtitle="Top học viên tích lũy XP nhiều nhất"
    >
      <div className="max-w-xl mx-auto space-y-4">

        {/* Header card */}
        <div className="bg-gradient-to-br from-[#00305E] to-[#1E4D8C] rounded-3xl p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
              <Trophy size={24} className="text-yellow-300" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg">Bảng xếp hạng XP</h2>
              <p className="text-white/60 text-xs">Top 20 học viên xuất sắc nhất</p>
            </div>
            <button
              type="button"
              onClick={fetchBoard}
              className="ml-auto w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
            >
              <RefreshCw size={15} />
            </button>
          </div>

          {/* My rank */}
          {myEntry && (
            <div className="bg-white/10 rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-yellow-400/20 flex items-center justify-center">
                <Star size={16} className="text-yellow-300" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-white/60">Xếp hạng của bạn</p>
                <p className="font-bold text-sm">#{myEntry.rank} — {myEntry.totalXp.toLocaleString()} XP</p>
              </div>
              <LevelBadge level={myEntry.level} />
            </div>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16 gap-3 text-[#64748B]">
            <Loader2 size={22} className="animate-spin text-[#00305E]" />
            <span>Đang tải...</span>
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-10">
            <p className="text-sm text-red-500 mb-4">{error}</p>
            <button type="button" onClick={fetchBoard} className="px-4 py-2 bg-[#00305E] text-white rounded-xl font-bold text-sm">
              Thử lại
            </button>
          </div>
        )}

        {!loading && !error && board.length === 0 && (
          <div className="text-center py-12">
            <Zap size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-[#64748B]">Chưa có dữ liệu XP. Hãy bắt đầu luyện nói!</p>
          </div>
        )}

        {/* Leaderboard rows */}
        {!loading && !error && board.map((entry, idx) => {
          const isMe = entry.userId === myUserId
          const isTop3 = entry.rank <= 3
          return (
            <motion.div
              key={entry.userId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04 }}
              className={`flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all ${
                isMe
                  ? 'bg-[#EEF2FF] border-[#C7D2FE] shadow-md'
                  : isTop3
                    ? 'bg-white border-[#FDE68A] shadow-sm'
                    : 'bg-white border-[#E2E8F0]'
              }`}
            >
              {/* Rank */}
              <div className="w-8 flex items-center justify-center">
                <RankIcon rank={entry.rank} />
              </div>

              {/* Avatar */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-sm ${
                isMe ? 'bg-[#6366F1] text-white' : 'bg-[#F1F5F9] text-[#64748B]'
              }`}>
                {entry.displayName.charAt(0).toUpperCase()}
              </div>

              {/* Name + level */}
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm truncate ${isMe ? 'text-[#4F46E5]' : 'text-[#0F172A]'}`}>
                  {entry.displayName} {isMe && '(Bạn)'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <LevelBadge level={entry.level} />
                </div>
              </div>

              {/* XP */}
              <div className="text-right">
                <p className={`font-extrabold text-sm ${isTop3 ? 'text-[#F59E0B]' : 'text-[#0F172A]'}`}>
                  {entry.totalXp.toLocaleString()}
                </p>
                <p className="text-[10px] text-[#94A3B8]">XP</p>
              </div>
            </motion.div>
          )
        })}
      </div>
    </StudentShell>
  )
}
