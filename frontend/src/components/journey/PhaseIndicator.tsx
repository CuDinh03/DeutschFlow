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
    <div className="relative bg-white rounded-[22px] border border-[#E8ECF2] overflow-hidden"
         style={{ boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06)' }}>
      {/* Subtle yellow glow accent on the top edge */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#FFCD00] to-transparent opacity-60" />

      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#94A3B8] mb-1.5">
              Hành trình 12 tuần
            </p>
            <h3 className="text-[17px] font-extrabold text-[#0F172A] tracking-tight">
              {phase.currentPhase === 'GRADUATED'
                ? '🎓 B1 Đạt chuẩn'
                : `Giai đoạn ${PHASES.find(p => p.key === phase.currentPhase)?.label ?? phase.currentPhase}`}
            </h3>
          </div>
          {phase.readyToAdvance && phase.currentPhase !== 'GRADUATED' && (
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="shrink-0 inline-flex items-center gap-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-full"
              style={{ boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)' }}
            >
              <CheckCircle2 size={12} />
              Sẵn sàng nâng cấp
            </motion.span>
          )}
        </div>
      </div>

      {/* Phase steps */}
      <div className="px-5 pb-4 flex items-stretch gap-1.5">
        {PHASES.map((p, i) => {
          const isCompleted = phaseIndex(p.key) < currentIdx
          const isCurrent   = p.key === phase.currentPhase
          const isLocked    = phaseIndex(p.key) > currentIdx

          return (
            <div key={p.key} className="flex items-center flex-1 gap-1.5">
              <motion.div
                initial={isCurrent ? { y: 4, opacity: 0.8 } : false}
                animate={isCurrent ? { y: 0, opacity: 1 } : {}}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className={`relative flex-1 rounded-[16px] p-3 border transition-all overflow-hidden ${
                  isCurrent
                    ? 'border-[#121212] text-white'
                    : isCompleted
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-[#F8FAFC] border-[#E8ECF2] text-[#CBD5E1]'
                }`}
                style={isCurrent ? {
                  background: 'linear-gradient(135deg, #1A1A1A 0%, #0A0A0A 100%)',
                  boxShadow: '0 8px 20px rgba(18, 18, 18, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
                } : undefined}
              >
                {/* Active phase yellow glow */}
                {isCurrent && (
                  <div className="absolute -top-8 -right-8 w-20 h-20 bg-[#FFCD00] opacity-[0.18] rounded-full blur-2xl" />
                )}
                <div className="relative flex items-center justify-between mb-1.5">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isCurrent ? 'text-[#FFCD00]' : isCompleted ? 'text-emerald-600' : 'text-[#CBD5E1]'}`}>
                    {p.weeks}
                  </span>
                  {isCompleted && <CheckCircle2 size={12} className="text-emerald-500" />}
                  {isLocked && <Lock size={10} className="text-[#CBD5E1]" />}
                </div>
                <p className={`relative text-[14px] font-extrabold tracking-tight ${isCurrent ? 'text-white' : isCompleted ? 'text-emerald-900' : 'text-[#CBD5E1]'}`}>
                  {p.label}
                </p>
                <p className={`relative text-[11px] mt-0.5 ${isCurrent ? 'text-white/65' : isCompleted ? 'text-emerald-700' : 'text-[#CBD5E1]'}`}>
                  {p.subtitle}
                </p>
              </motion.div>
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
  const isComplete = pct >= 100

  return (
    <div
      className="relative bg-gradient-to-br from-white to-[#F8FAFC] rounded-[14px] p-3 border border-[#E8ECF2] overflow-hidden"
      style={{ boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 1px 2px rgba(15, 23, 42, 0.03)' }}
    >
      {isComplete && (
        <div className="absolute top-2 right-2">
          <CheckCircle2 size={12} className="text-emerald-500" />
        </div>
      )}
      <p className="text-[10px] text-[#64748B] font-bold uppercase tracking-[0.12em] mb-1.5">{label}</p>
      <p className="text-[17px] font-extrabold text-[#0F172A] tracking-tight leading-none">
        {value}<span className="text-[11px] font-medium text-[#94A3B8] ml-1">{unit}</span>
      </p>
      <div
        className="mt-2.5 h-[5px] bg-[#EEF1F6] rounded-full overflow-hidden"
        style={{ boxShadow: 'inset 0 0.5px 1px rgba(0, 0, 0, 0.06)' }}
      >
        <motion.div
          className="h-full rounded-full relative"
          style={{
            background: `linear-gradient(90deg, ${color} 0%, ${color}DD 100%)`,
            boxShadow: pct > 0 ? `0 0 6px ${color}66` : 'none',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
      <p className="text-[10px] text-[#94A3B8] font-semibold mt-1.5">{pct}% <span className="text-[#CBD5E1]">/ {target}</span></p>
    </div>
  )
}
