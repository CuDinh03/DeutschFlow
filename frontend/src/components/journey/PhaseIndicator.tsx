'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, Lock, ChevronRight } from 'lucide-react'
import type { PhaseStateResponse, PhaseType } from '@/lib/phaseApi'

const PHASES: { key: PhaseType; label: string; subtitle: string; weeks: string }[] = [
  { key: 'FOUNDATION', label: 'Foundation',  subtitle: 'A1 – Bắt đầu',   weeks: 'Tuần 1–4' },
  { key: 'PRODUCTION', label: 'Production',  subtitle: 'A2 – Luyện tập', weeks: 'Tuần 5–8' },
  { key: 'FLUENCY',    label: 'Fluency',     subtitle: 'B1 – Thành thạo', weeks: 'Tuần 9–12' },
]

const PHASE_ORDER: PhaseType[] = ['FOUNDATION', 'PRODUCTION', 'FLUENCY', 'GRADUATED']

function phaseIndex(phase: PhaseType): number {
  return PHASE_ORDER.indexOf(phase)
}

interface Props {
  phase: PhaseStateResponse
}

export function PhaseIndicator({ phase }: Props) {
  const currentIdx = phaseIndex(phase.currentPhase)

  return (
    <div className="bg-white rounded-[20px] border border-[#E2E8F0] shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-[#F1F4F9]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#94A3B8] mb-1">
              Hành trình 12 tuần
            </p>
            <h3 className="text-base font-extrabold text-[#0F172A]">
              {phase.currentPhase === 'GRADUATED'
                ? '🎓 B1 Đạt chuẩn'
                : `Đang ở giai đoạn ${PHASES.find(p => p.key === phase.currentPhase)?.label ?? phase.currentPhase}`}
            </h3>
          </div>
          {phase.readyToAdvance && phase.currentPhase !== 'GRADUATED' && (
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-200"
            >
              <CheckCircle2 size={12} />
              Sẵn sàng nâng cấp
            </motion.span>
          )}
        </div>
      </div>

      {/* Phase steps */}
      <div className="px-5 py-4 flex items-center gap-2">
        {PHASES.map((p, i) => {
          const isCompleted = phaseIndex(p.key) < currentIdx
          const isCurrent   = p.key === phase.currentPhase
          const isLocked    = phaseIndex(p.key) > currentIdx

          return (
            <div key={p.key} className="flex items-center flex-1 gap-2">
              <div
                className={`flex-1 rounded-[14px] p-3 border transition-all ${
                  isCurrent
                    ? 'bg-[#121212] border-[#121212] text-white shadow-md'
                    : isCompleted
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#CBD5E1]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isCurrent ? 'text-white/60' : isCompleted ? 'text-emerald-600' : 'text-[#CBD5E1]'}`}>
                    {p.weeks}
                  </span>
                  {isCompleted && <CheckCircle2 size={12} className="text-emerald-500" />}
                  {isLocked && <Lock size={10} className="text-[#CBD5E1]" />}
                </div>
                <p className={`text-sm font-extrabold ${isCurrent ? 'text-white' : isCompleted ? 'text-emerald-900' : 'text-[#CBD5E1]'}`}>
                  {p.label}
                </p>
                <p className={`text-[11px] mt-0.5 ${isCurrent ? 'text-white/70' : isCompleted ? 'text-emerald-700' : 'text-[#CBD5E1]'}`}>
                  {p.subtitle}
                </p>
              </div>
              {i < PHASES.length - 1 && (
                <ChevronRight size={14} className={isCompleted ? 'text-emerald-400' : 'text-[#E2E8F0]'} />
              )}
            </div>
          )
        })}
      </div>

      {/* Metrics bar */}
      <div className="px-5 pb-5 grid grid-cols-3 gap-3">
        <Metric
          label="Từ đã học"
          value={phase.vocabularyMasteredCount}
          target={
            phase.currentPhase === 'FOUNDATION' ? 50
            : phase.currentPhase === 'PRODUCTION' ? 250
            : 700
          }
          unit="từ"
          color="#FFCD00"
        />
        <Metric
          label="Phút nói"
          value={phase.speakingMinutesTotal}
          target={
            phase.currentPhase === 'FOUNDATION' ? 120
            : phase.currentPhase === 'PRODUCTION' ? 600
            : 1500
          }
          unit="phút"
          color="#60a5fa"
        />
        <Metric
          label="Buổi học"
          value={phase.sessionsCompleted}
          target={
            phase.currentPhase === 'FOUNDATION' ? 8
            : phase.currentPhase === 'PRODUCTION' ? 20
            : 40
          }
          unit="buổi"
          color="#34d399"
        />
      </div>
    </div>
  )
}

function Metric({ label, value, target, unit, color }: {
  label: string
  value: number
  target: number
  unit: string
  color: string
}) {
  const pct = Math.min(100, Math.round((value / target) * 100))

  return (
    <div className="bg-[#F8FAFC] rounded-[12px] p-3 border border-[#F1F4F9]">
      <p className="text-[10px] text-[#94A3B8] font-semibold uppercase tracking-wider mb-1">{label}</p>
      <p className="text-base font-extrabold text-[#0F172A]">
        {value}<span className="text-xs font-normal text-[#94A3B8] ml-1">{unit}</span>
      </p>
      <div className="mt-2 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
      <p className="text-[10px] text-[#94A3B8] mt-1">{pct}% / {target}</p>
    </div>
  )
}
