/**
 * Hàm thuần cho Thi thử và Kết quả (đợt (d) làm mới Luyện thi, 07/11/2026).
 *
 * Thi thử đi theo thứ tự của buổi thi telc thật: Lesen + Sprachbausteine → Hören → Schreiben. Mỗi
 * chặng chỉ làm Teil của chặng đó; sang chặng sau thì không quay lại chặng trước ("Vào Hören là không
 * quay lại Lesen"). Hören lại không nghe lại được, nên sang Schreiben cũng khoá Hören.
 */
import type { ExamGate } from '@/components/exam/telc/examGates'
import type { ExamBudget } from '@/components/exam/telc/examBudget'

export const STAGE_OF: Record<string, number> = { LESEN: 0, SPRACHBAUSTEINE: 0, HOEREN: 1, SCHREIBEN: 2 }

export function stageOf(section: string): number {
  return STAGE_OF[section] ?? 0
}

/** Các chặng có trong đề, theo thứ tự. */
export function stagesOf(teile: { section: string }[]): number[] {
  return Array.from(new Set(teile.map((x) => stageOf(x.section)))).sort((a, b) => a - b)
}

export function firstIdxOf(teile: { section: string }[], stage: number): number {
  const i = teile.findIndex((x) => stageOf(x.section) === stage)
  return i < 0 ? 0 : i
}

export function lastIdxOf(teile: { section: string }[], stage: number): number {
  for (let i = teile.length - 1; i >= 0; i--) if (stageOf(teile[i].section) === stage) return i
  return teile.length - 1
}

/** Chặng kế tiếp có trong đề; `null` khi đang ở chặng cuối. */
export function nextStage(teile: { section: string }[], stage: number): number | null {
  return stagesOf(teile).find((s) => s > stage) ?? null
}

/** Chặng khi mở lại lượt đang dở: chặng đã lưu trên máy, hoặc chặng của Teil server nhớ — lấy cái sau. */
export function resumeStage(teile: { section: string }[], resumeIdx: number, saved: number | null): number {
  const fromServer = teile[resumeIdx] ? stageOf(teile[resumeIdx].section) : 0
  return Math.max(fromServer, saved ?? 0)
}

export type ModeId = 'all' | 'written' | 'oral'

/** Thời lượng và điểm của từng phần, telc Deutsch B1 (định dạng đề cố định). */
export const TELC_B1_PARTS = [
  { id: 'LESEN', sections: ['LESEN', 'SPRACHBAUSTEINE'], minutes: 90, points: 105, oral: false },
  { id: 'HOEREN', sections: ['HOEREN'], minutes: 30, points: 75, oral: false },
  { id: 'SCHREIBEN', sections: ['SCHREIBEN'], minutes: 30, points: 45, oral: false },
  { id: 'SPRECHEN', sections: ['SPRECHEN'], minutes: 15, points: 75, oral: true },
] as const

export function modeMinutes(mode: ModeId): number {
  return TELC_B1_PARTS.filter((p) => (mode === 'all' ? true : mode === 'oral' ? p.oral : !p.oral)).reduce((s, p) => s + p.minutes, 0)
}

export interface GateView {
  raw: number
  max: number
  min: number
  status: string
  /** raw − min; null khi chưa thi. */
  margin: number | null
  pct: number
  markPct: number
}

export function gateView(gates: ExamGate[] | undefined, id: 'written' | 'oral'): GateView | null {
  const g = gates?.find((x) => x.id === id)
  if (!g) return null
  return {
    raw: g.raw,
    max: g.max,
    min: g.min,
    status: g.status,
    margin: g.status === 'PENDING' ? null : Math.round((g.raw - g.min) * 10) / 10,
    pct: g.max > 0 ? (g.raw / g.max) * 100 : 0,
    markPct: g.max > 0 ? (g.min / g.max) * 100 : 60,
  }
}

export interface LostRow {
  /** Khoá Teil để mở xem lại (`LESEN-2`, `SCHREIBEN-1`). */
  key: string
  section: string
  teil: number
  lost: number
  wrong: number | null
  items: number | null
}

/** Ba chỗ mất điểm nhiều nhất của phần viết (bỏ phần Nói và dòng chưa chấm). */
export function lostRows(budget: ExamBudget | null | undefined, limit = 3): LostRow[] {
  return (budget?.losses ?? [])
    .filter((r) => r.section !== 'SPRECHEN' && !r.pending && (r.lost ?? 0) > 0)
    .sort((a, b) => (b.lost ?? 0) - (a.lost ?? 0))
    .slice(0, limit)
    .map((r) => ({
      key: `${r.section}-${r.teil ?? 1}`,
      section: r.section,
      teil: r.teil ?? 1,
      lost: Math.round((r.lost ?? 0) * 10) / 10,
      wrong: r.items != null && r.correct != null ? r.items - r.correct : null,
      items: r.items ?? null,
    }))
}

/** Bài viết của lượt thi mang sang chế độ luyện cho nút "Viết lại bài này" (sessionStorage). */
export const REWRITE_KEY = (examId: number) => `df.practice.rewrite.${examId}`
