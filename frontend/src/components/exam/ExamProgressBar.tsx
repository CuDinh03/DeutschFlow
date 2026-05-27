'use client'

import { BookOpen, Headphones, PenTool, Mic2 } from 'lucide-react'

const SECTION_ICONS: Record<string, React.ReactNode> = {
  LESEN: <BookOpen size={14} />,
  HOEREN: <Headphones size={14} />,
  SCHREIBEN: <PenTool size={14} />,
  SPRECHEN: <Mic2 size={14} />,
}

const SECTION_COLORS: Record<string, string> = {
  LESEN: '#6366F1',
  HOEREN: '#0EA5E9',
  SCHREIBEN: '#10B981',
  SPRECHEN: '#F59E0B',
}

interface ExamProgressBarProps {
  sections: Array<{ name: string; label_vi: string }>
  currentSectionIdx: number
  answeredCount: number
  totalQuestions: number
}

export function ExamProgressBar({ sections, currentSectionIdx, answeredCount, totalQuestions }: ExamProgressBarProps) {
  const overallPct = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0

  return (
    <div className="bg-white border-b border-[#E2E8F0] px-6 py-2">
      {/* Section dots */}
      <div className="flex items-center gap-2 mb-2">
        {sections.map((s, idx) => {
          const color = SECTION_COLORS[s.name] ?? '#6366F1'
          const isDone = idx < currentSectionIdx
          const isCurrent = idx === currentSectionIdx
          return (
            <div
              key={s.name}
              className="flex items-center gap-1"
              title={s.label_vi}
            >
              <div
                className="flex items-center justify-center w-6 h-6 rounded-full text-white transition-all"
                style={{
                  background: isCurrent ? color : isDone ? '#94A3B8' : '#E2E8F0',
                  color: isCurrent || isDone ? 'white' : '#94A3B8',
                  transform: isCurrent ? 'scale(1.15)' : 'scale(1)',
                }}
              >
                {SECTION_ICONS[s.name]}
              </div>
              {idx < sections.length - 1 && (
                <div
                  className="w-8 h-0.5 rounded-full transition-all"
                  style={{ background: idx < currentSectionIdx ? '#94A3B8' : '#E2E8F0' }}
                />
              )}
            </div>
          )
        })}
        <span className="ml-auto text-xs font-semibold text-[#64748B]">
          {answeredCount}/{totalQuestions} câu
        </span>
      </div>

      {/* Overall progress bar */}
      <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${overallPct}%`,
            background: `linear-gradient(90deg, #6366F1, #0EA5E9)`,
          }}
        />
      </div>
    </div>
  )
}
