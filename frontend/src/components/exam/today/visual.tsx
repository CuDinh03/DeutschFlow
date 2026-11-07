'use client'

import * as React from 'react'
import {
  BookOpen,
  CalendarCheck,
  Coffee,
  FileText,
  Headphones,
  Mic,
  PenLine,
  Puzzle,
  Route,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { GaGlyph } from '@/components/ui-v2/GaGlyph'
import type { ExamPlanDay } from '@/lib/examPlanApi'
import { PASS_PCT, type SkillStatus } from './todayModel'

export const SECTION_ICON: Record<string, LucideIcon> = {
  LESEN: BookOpen,
  SPRACHBAUSTEINE: Puzzle,
  HOEREN: Headphones,
  SCHREIBEN: PenLine,
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

/**
 * Ô icon nhận diện của Luyện thi — chính là `GaGlyph` dùng chung của web (cùng cỡ, cùng tông ở mọi
 * khu), giữ tên `Glyph` cho các màn đã dùng.
 */
export function Glyph({ icon, tone = 'navy', size = 'md', className }: { icon: LucideIcon; tone?: 'navy' | 'yellow' | 'plain' | 'ink'; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return <GaGlyph icon={icon} tone={tone} size={size} className={className} />
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
