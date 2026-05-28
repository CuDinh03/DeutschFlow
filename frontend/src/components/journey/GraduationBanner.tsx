'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Trophy, Star, ChevronRight } from 'lucide-react'
import type { PhaseStateResponse } from '@/lib/phaseApi'

interface Props {
  phase: PhaseStateResponse
}

export function GraduationBanner({ phase }: Props) {
  const graduatedAt = phase.graduatedAt
    ? new Date(phase.graduatedAt).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-emerald-600 to-emerald-800 text-white px-6 py-7 shadow-lg"
    >
      {/* Background decoration */}
      <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5" />
      <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full bg-white/5" />

      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={18} className="text-yellow-300" />
          <span className="text-xs font-bold uppercase tracking-widest text-white/60">
            Hoàn thành hành trình 12 tuần
          </span>
        </div>

        <h2 className="text-2xl font-extrabold mb-1 flex items-center gap-2">
          🎓 Bạn đã đạt chuẩn B1!
        </h2>

        <p className="text-sm text-white/75 mb-4">
          Chúc mừng! Bạn đã hoàn thành toàn bộ hành trình học tiếng Đức từ con số không.
          {graduatedAt && ` Tốt nghiệp ngày ${graduatedAt}.`}
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <StatPill label="Từ đã học" value={`${phase.vocabularyMasteredCount}`} />
          <StatPill label="Phút nói" value={`${phase.speakingMinutesTotal}`} />
          <StatPill label="Buổi học" value={`${phase.sessionsCompleted}`} />
        </div>

        <div className="flex gap-3 flex-wrap">
          <Link
            href="/student/certificates"
            className="inline-flex items-center gap-1.5 bg-white text-emerald-800 text-xs font-extrabold px-4 py-2.5 rounded-xl hover:bg-emerald-50 transition-colors"
          >
            <Star size={13} className="fill-emerald-600 text-emerald-600" />
            Xem chứng chỉ
          </Link>
          <Link
            href="/student/assessment"
            className="inline-flex items-center gap-1.5 bg-white/15 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-white/20 transition-colors"
          >
            Chi tiết đánh giá <ChevronRight size={12} />
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/10 rounded-[12px] px-3 py-2 text-center">
      <p className="text-base font-extrabold">{value}</p>
      <p className="text-[10px] text-white/60 mt-0.5">{label}</p>
    </div>
  )
}
