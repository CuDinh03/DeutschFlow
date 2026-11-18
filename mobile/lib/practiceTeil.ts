// Phép thuần của màn luyện một Teil trên app (Đợt 4, 19/11/2026). Đề đã bóc bằng `parseExamSections`
// (cùng bộ bóc của màn thi thử) — ở đây chỉ tìm đúng Teil theo khoá `TÊN_PHẦN-số` như backend, và
// tính tiến độ, Teil kế tiếp, nhãn kết quả. Không gọi API, không đụng React — để test được.

import type { ExamObjGroup, ExamWritingTask, ParsedExam } from './examApi'
import type { PracticeOverview, PracticeTeil, PracticeTeilResult, WritingEvaluation } from './telcPracticeApi'
import { PASS_PCT, sectionShort, statusOf, STATUS_LABEL } from './examHub'

/** Khoá câu trả lời của bài Viết trong chế độ luyện (khác thi thử dùng `email_<teil>`). */
export const WRITING_TEXT_KEY = 'text'

export type LocatedTeil =
  | { kind: 'objective'; section: string; group: ExamObjGroup }
  | { kind: 'writing'; section: string; task: ExamWritingTask }

export function splitTeilKey(key: string): { section: string; teil: number } | null {
  const dash = key.lastIndexOf('-')
  if (dash <= 0) return null
  const teil = Number(key.slice(dash + 1))
  return Number.isInteger(teil) && teil > 0 ? { section: key.slice(0, dash), teil } : null
}

/** Teil theo khoá; Teil không đánh số trong đề thì lấy theo thứ tự (như `findTeil` của web: thiếu số = 1). */
export function locateTeil(parsed: ParsedExam | null, key: string): LocatedTeil | null {
  const k = splitTeilKey(key)
  if (!parsed || !k) return null
  const sec = parsed.sections.find((s) => s.name === k.section)
  if (!sec) return null
  if (k.section === 'SCHREIBEN') {
    const task = sec.writing.find((w) => w.teil === k.teil) ?? (k.teil === 1 ? sec.writing[0] : undefined)
    return task ? { kind: 'writing', section: sec.name, task } : null
  }
  const group = sec.groups.find((g, i) => (g.teilNo ?? i + 1) === k.teil)
  return group ? { kind: 'objective', section: sec.name, group } : null
}

export function answeredCount(group: ExamObjGroup, answers: Record<string, string>): number {
  return group.items.filter((it) => (answers[it.id] ?? '').trim() !== '').length
}

/** Teil kế tiếp theo thứ tự của đề; `null` sau Teil cuối. */
export function nextTeilKey(overview: Pick<PracticeOverview, 'teile'>, key: string): string | null {
  const i = overview.teile.findIndex((t) => t.key === key)
  return i >= 0 && i + 1 < overview.teile.length ? overview.teile[i + 1].key : null
}

/** "Lesen · Teil 2" (tên phần giữ tiếng Đức). */
export const teilTitle = (key: string): string => {
  const k = splitTeilKey(key)
  return k ? `${sectionShort(k.section)} · Teil ${k.teil}` : key
}

export interface ScoreSummary {
  score: number
  max: number
  pct: number
  passed: boolean
  label: string
}

export function scoreSummary(score: number | null | undefined, max: number | null | undefined): ScoreSummary | null {
  if (score == null || !max || max <= 0) return null
  const pct = Math.round((score / max) * 100)
  return { score, max, pct, passed: pct >= PASS_PCT, label: STATUS_LABEL[statusOf(pct)] }
}

/** Kết quả trắc nghiệm của tiến độ (bỏ phiếu chấm Viết). */
export function objectiveResult(result: PracticeTeilResult | WritingEvaluation | null | undefined): PracticeTeilResult | null {
  return result && 'items' in result && Array.isArray(result.items) ? (result as PracticeTeilResult) : null
}

/** Phiếu chấm Viết của tiến độ, nếu có. */
export function writingResult(result: PracticeTeilResult | WritingEvaluation | null | undefined): WritingEvaluation | null {
  return result && !('items' in result) && typeof (result as WritingEvaluation).total === 'number' ? (result as WritingEvaluation) : null
}

/** Trạng thái một Teil ở màn Đề: mới, đang làm (n câu / số từ), đã kiểm tra (điểm). */
export function teilStatus(t: PracticeTeil): { tone: 'new' | 'doing' | 'pass' | 'fail'; text: string } {
  const p = t.progress
  if (p?.checked) {
    const s = scoreSummary(p.score, p.max ?? t.maxPoints)
    if (!s) return { tone: 'doing', text: 'Đã kiểm tra' }
    return { tone: s.passed ? 'pass' : 'fail', text: `${s.score}/${s.max} · ${s.label}` }
  }
  const answers = p?.answers ?? {}
  if (t.section === 'SCHREIBEN') {
    const words = (answers[WRITING_TEXT_KEY] ?? '').trim().split(/\s+/).filter(Boolean).length
    return words > 0 ? { tone: 'doing', text: `Đang viết · ${words} từ` } : { tone: 'new', text: 'Chưa làm' }
  }
  const done = Object.values(answers).filter((v) => (v ?? '').trim() !== '').length
  return done > 0 ? { tone: 'doing', text: `Đang làm · ${done}/${t.items} câu` } : { tone: 'new', text: 'Chưa làm' }
}

/** Teil đang làm dở đầu tiên (để hiện "Làm tiếp"). */
export function continueTeil(overview: Pick<PracticeOverview, 'teile'>): PracticeTeil | null {
  return overview.teile.find((t) => !t.progress?.checked && teilStatus(t).tone === 'doing') ?? null
}

/** Khoá truy vấn tổng quan luyện đề của một đề (màn Đề, màn Teil, bài chẩn đoán dùng chung). */
export const practiceOverviewKey = (examId: number) => ['practice-overview', examId] as const

/** 75 giây → "1:15". */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
