'use client'

import { TkBadge } from '@/components/ui-v2'

// Shared visual building blocks for the four /v2/teacher/tc-reports tabs
// (gradebook, skill report, attendance/lesson-log, evaluation) — keeps score
// coloring and the print masthead identical across all four.

/** Per-skill accent color, consistent across gradebook / skill-report / evaluation. */
export const SKILL_COLORS = {
  horen: 'var(--ga-blue)',
  lesen: 'var(--ga-green)',
  schreiben: 'var(--ga-violet)',
  sprechen: 'var(--ga-gold)',
} as const

function scoreTone(score: number, goodMin: number, midMin: number): 'green' | 'yellow' | 'red' {
  if (score >= goodMin) return 'green'
  if (score >= midMin) return 'yellow'
  return 'red'
}

/** Score badge. `scale=10` for the 0–10 evaluation/skill scores, `scale=100` for assignment percentages. */
export function ScoreBadge({ score, scale }: { score: number | null; scale: 10 | 100 }) {
  if (score == null) return <span className="text-[12px] text-ga-subtle">—</span>
  const tone = scale === 10 ? scoreTone(score, 8, 5) : scoreTone(score, 80, 50)
  return (
    <TkBadge tone={tone} variant="soft">
      {score.toFixed(1)}
    </TkBadge>
  )
}

const GRADE_TONE: Record<string, 'green' | 'blue' | 'violet' | 'yellow' | 'red'> = {
  'Xuất sắc': 'green',
  'Giỏi': 'blue',
  'Khá': 'violet',
  'Trung bình': 'yellow',
  'Yếu': 'red',
}

/** Renders the class-average letter grade returned by the backend (`SkillReportDto.gradeOf`). */
export function GradeBadge({ grade }: { grade: string }) {
  return (
    <TkBadge tone={GRADE_TONE[grade] ?? 'neutral'} variant="soft">
      {grade}
    </TkBadge>
  )
}

/** Horizontal 0–10 skill bar, e.g. Hören/Lesen/Schreiben/Sprechen rows. */
export function SkillBar({ value, color }: { value: number | null; color: string }) {
  if (value == null) return <span className="text-[12px] text-ga-subtle">—</span>
  const pct = Math.min((value / 10) * 100, 100)
  return (
    <div className="flex min-w-[100px] items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-ga-line">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-8 shrink-0 text-right text-[12px] font-bold text-ga-ink">{value.toFixed(1)}</span>
    </div>
  )
}

interface ReportPrintHeaderProps {
  title: string
  subtitle?: string
  metaLine?: string
  exportedAtLabel: string
}

/**
 * Print-only masthead — hidden on screen, shown only inside the printed page.
 * Each tab wraps its printable table/list in `.print-area` (globals.css isolates
 * visibility under @media print) and renders this at the top of that container.
 */
export function ReportPrintHeader({ title, subtitle, metaLine, exportedAtLabel }: ReportPrintHeaderProps) {
  return (
    <div className="mb-4 hidden border-b-2 border-ga-ink pb-3 print:block">
      <p className="text-[10px] font-bold uppercase tracking-widest text-ga-subtle">DeutschFlow</p>
      <h1 className="mt-0.5 text-[18px] font-black text-ga-ink">{title}</h1>
      {subtitle && <p className="mt-0.5 text-[12px] text-ga-muted">{subtitle}</p>}
      {metaLine && <p className="mt-0.5 text-[12px] font-semibold text-ga-ink">{metaLine}</p>}
      <p className="mt-1 text-right text-[10px] text-ga-subtle">{exportedAtLabel}</p>
    </div>
  )
}
