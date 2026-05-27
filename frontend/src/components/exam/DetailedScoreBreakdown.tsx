'use client'

import { BookOpen, Headphones, PenTool, Mic2, CheckCircle, XCircle, Clock } from 'lucide-react'

const SECTION_META: Record<string, { icon: React.ReactNode; labelVi: string; color: string }> = {
  LESEN: { icon: <BookOpen size={18} />, labelVi: 'Đọc hiểu', color: '#6366F1' },
  HOEREN: { icon: <Headphones size={18} />, labelVi: 'Nghe hiểu', color: '#0EA5E9' },
  SCHREIBEN: { icon: <PenTool size={18} />, labelVi: 'Viết', color: '#10B981' },
  SPRECHEN: { icon: <Mic2 size={18} />, labelVi: 'Nói', color: '#F59E0B' },
}

const PASS_THRESHOLD = 60 // percent

interface SectionScore {
  total?: number
  max?: number
  percentage?: number
  status?: string
  total_provisional?: number
  total_max?: number
}

interface DetailedScoreBreakdownProps {
  detailedScores: Record<string, SectionScore>
  totalScore: number
  passed: boolean
}

function SectionCard({ section, data }: { section: string; data: SectionScore }) {
  const meta = SECTION_META[section]
  const score = data.total ?? data.total_provisional ?? 0
  const max = data.max ?? data.total_max ?? 25
  const pct = data.percentage ?? (max > 0 ? Math.round((score / max) * 100) : 0)
  const isPassing = pct >= PASS_THRESHOLD
  const isPending = data.status?.includes('PENDING') || data.total_provisional !== undefined

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 relative overflow-hidden">
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
        style={{ background: meta.color }}
      />
      <div className="pl-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: meta.color + '18', color: meta.color }}
            >
              {meta.icon}
            </div>
            <div>
              <p className="font-bold text-sm text-[#0F172A]">{section}</p>
              <p className="text-xs text-[#64748B]">{meta.labelVi}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isPending ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                <Clock size={12} /> Chờ chấm
              </span>
            ) : isPassing ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                <CheckCircle size={12} /> Đạt
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-1 rounded-lg">
                <XCircle size={12} /> Chưa đạt
              </span>
            )}
          </div>
        </div>

        <div className="flex items-end justify-between mb-2">
          <p className="text-2xl font-black" style={{ color: meta.color }}>
            {score}
            <span className="text-sm font-semibold text-[#94A3B8]">/{max}</span>
          </p>
          <p className="text-sm font-bold text-[#0F172A]">{pct}%</p>
        </div>

        {/* Score bar */}
        <div className="relative h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: meta.color }}
          />
          {/* Pass threshold marker at 60% */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-[#CBD5E1]"
            style={{ left: `${PASS_THRESHOLD}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <p className="text-xs text-[#94A3B8]">0</p>
          <p className="text-xs text-[#94A3B8]" style={{ marginLeft: `${PASS_THRESHOLD - 5}%` }}>
            Đạt
          </p>
          <p className="text-xs text-[#94A3B8]">{max}</p>
        </div>

        {isPending && (
          <p className="text-xs text-amber-600 mt-2 bg-amber-50 rounded-lg px-2 py-1.5">
            {section === 'SCHREIBEN'
              ? '✍️ Phần viết email sẽ được AI chấm điểm'
              : '🎤 Phần nói cần giáo viên chấm thủ công'}
          </p>
        )}
      </div>
    </div>
  )
}

export function DetailedScoreBreakdown({ detailedScores, totalScore, passed }: DetailedScoreBreakdownProps) {
  const sections = ['LESEN', 'HOEREN', 'SCHREIBEN', 'SPRECHEN']

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-[#0F172A]">Điểm chi tiết theo phần</h3>
        <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
          <div className="w-0.5 h-3 bg-[#CBD5E1] rounded" />
          <span>Ngưỡng đạt (60%)</span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sections.map(sec => {
          const data = detailedScores[sec]
          if (!data) return null
          return <SectionCard key={sec} section={sec} data={data} />
        })}
      </div>

      {/* Total summary */}
      <div
        className={`rounded-2xl p-4 text-white flex items-center justify-between ${
          passed
            ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
            : 'bg-gradient-to-r from-slate-600 to-slate-700'
        }`}
      >
        <div>
          <p className="font-bold text-white/80 text-sm">Tổng điểm (tạm tính)</p>
          <p className="text-xs text-white/60 mt-0.5">Điểm chính thức sau khi chấm xong</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black">{totalScore}</p>
          <p className="text-sm text-white/70">/ 100</p>
        </div>
      </div>
    </div>
  )
}
