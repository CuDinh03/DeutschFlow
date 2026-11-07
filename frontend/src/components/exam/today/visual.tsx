'use client'

import * as React from 'react'
import {
  BookOpen,
  CalendarCheck,
  Coffee,
  FileText,
  Headphones,
  Mic,
  PenTool,
  Puzzle,
  Route,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExamPlanDay } from '@/lib/examPlanApi'
import { PASS_PCT, type SkillStatus } from './todayModel'

export const SECTION_ICON: Record<string, LucideIcon> = {
  LESEN: BookOpen,
  SPRACHBAUSTEINE: Puzzle,
  HOEREN: Headphones,
  SCHREIBEN: PenTool,
  SPRECHEN: Mic,
}

export function dayIcon(day: Pick<ExamPlanDay, 'kind' | 'section'>): LucideIcon {
  switch (day.kind) {
    case 'TEIL':
      return SECTION_ICON[day.section ?? ''] ?? BookOpen
    case 'FULL_EXAM':
      return FileText
    case 'ORAL_MOCK':
    case 'ORAL_DRILL':
      return Mic
    case 'ROADMAP':
      return Route
    case 'EXAM_DAY':
      return CalendarCheck
    default:
      return Coffee
  }
}

/** Ô icon kiểu GaGlyph: vuông bo nhẹ, nền mềm. */
export function Glyph({ icon: Icon, tone = 'navy', size = 'md', className }: { icon: LucideIcon; tone?: 'navy' | 'yellow' | 'plain' | 'ink'; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const box = size === 'lg' ? 'h-12 w-12' : size === 'sm' ? 'h-7 w-7' : 'h-9 w-9'
  const px = size === 'lg' ? 24 : size === 'sm' ? 15 : 18
  const bg =
    tone === 'yellow' ? 'bg-ga-yellow text-ga-ink' : tone === 'plain' ? 'bg-ga-side-active text-ga-muted' : tone === 'ink' ? 'bg-ga-ink text-ga-card' : 'bg-ga-navy-soft text-ga-navy'
  return (
    <span aria-hidden className={cn('grid shrink-0 place-items-center rounded-ga', box, bg, className)}>
      <Icon size={px} strokeWidth={1.9} />
    </span>
  )
}

/** Thanh tiến độ có vạch ngưỡng 60%; phần tô chạy từ 0 khi mới hiện. */
export function Bar({ pct, className, mark = PASS_PCT }: { pct: number | null; className?: string; mark?: number | null }) {
  const w = Math.max(0, Math.min(100, pct ?? 0))
  return (
    <span className={cn('relative block h-1.5 rounded-ga-pill bg-ga-side-active', className)} aria-hidden>
      {pct != null && <span className="ga-bar-grow absolute inset-y-0 left-0 rounded-ga-pill bg-ga-navy" style={{ width: `${w}%` }} />}
      {mark != null && <span className="absolute -bottom-1.5 -top-1.5 w-0.5 bg-ga-ink" style={{ left: `${mark}%` }} />}
    </span>
  )
}

export const STATUS_TEXT_CLASS: Record<SkillStatus, string> = {
  ok: 'text-ga-green',
  near: 'text-ga-ink',
  below: 'text-ga-red',
  none: 'text-ga-muted',
}
