// Hàm thuần cho nhóm màn Học và ôn (giao diện v3.4, Đợt 6A, 19/11/2026): bài học, luyện tập,
// luyện 4 kỹ năng, ngữ pháp, từ vựng, ôn thẻ, sửa lỗi, video ôn tập. Chỉ định dạng/gom nhóm
// để hiển thị — không đụng logic chấm hay dữ liệu gửi lên server.

import { answerKey, type SkillAnswer, type SkillKey } from '@/lib/skillExercises'

// ── Bài học (mẫu `lesson`) ───────────────────────────────────────────────────

export type LessonTab = 'theory' | 'vocab' | 'phrases'

/** Các thẻ của thanh chia đoạn "Lý thuyết | Từ vựng · N | Mẫu câu" — chỉ thẻ có nội dung. */
export function lessonTabs(counts: { theory: number; vocab: number; phrases: number }): { key: LessonTab; label: string }[] {
  const tabs: { key: LessonTab; label: string }[] = []
  if (counts.theory > 0) tabs.push({ key: 'theory', label: 'Lý thuyết' })
  if (counts.vocab > 0) tabs.push({ key: 'vocab', label: `Từ vựng · ${counts.vocab}` })
  if (counts.phrases > 0) tabs.push({ key: 'phrases', label: 'Mẫu câu' })
  return tabs
}

/**
 * Thẻ đang mở. Lựa chọn lưu kèm `nodeId` (màn là tab ẩn, không unmount): sang bài khác thì lựa
 * chọn cũ không còn hiệu lực và quay về thẻ đầu tiên có nội dung.
 */
export function activeLessonTab(
  tabs: readonly { key: LessonTab }[],
  picked: { nodeId: number; tab: LessonTab } | null,
  nodeId: number,
): LessonTab | null {
  if (tabs.length === 0) return null
  if (picked && picked.nodeId === nodeId && tabs.some((t) => t.key === picked.tab)) return picked.tab
  return tabs[0].key
}

/** Tiêu đề lớn có vệt vàng: vệt nằm ở từ cuối (mẫu tô một từ trong tiêu đề). Một từ thì tô cả từ. */
export function splitMarkTitle(title: string): { lead: string; mark: string } {
  const words = title.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return { lead: '', mark: '' }
  if (words.length === 1) return { lead: '', mark: words[0] }
  return { lead: words.slice(0, -1).join(' '), mark: words[words.length - 1] }
}

export type BadgeTone = 'neutral' | 'yellow' | 'green' | 'red' | 'ink'

/** Nhãn trạng thái bài học ở góc phải đầu màn. */
export function nodeStatusBadge(status: string | null | undefined): { label: string; tone: BadgeTone } {
  if (status === 'COMPLETED') return { label: 'Đã hoàn thành', tone: 'green' }
  if (status === 'IN_PROGRESS') return { label: 'Đang học', tone: 'yellow' }
  return { label: 'Bắt đầu', tone: 'neutral' }
}

/** Dòng chữ nhỏ trên tiêu đề bài học: "A2 · Perfekt" (cấp + tên tiếng Đức nếu có). */
export function lessonEyebrow(cefr: string | null | undefined, titleDe: string | null | undefined): string {
  return [cefr, titleDe].filter((s): s is string => !!s && s.trim().length > 0).join(' · ')
}

// ── Luyện tập (mẫu `practice`) ───────────────────────────────────────────────

export const EXERCISE_KIND_LABEL: Record<string, string> = {
  MULTIPLE_CHOICE: 'Chọn đáp án',
  FILL_BLANK: 'Điền chỗ trống',
  TRANSLATE: 'Dịch',
  REORDER: 'Sắp xếp',
}

/** Các dạng bài có trong bài học, giữ thứ tự xuất hiện, không lặp. Dạng lạ bị bỏ. */
export function exerciseKinds(types: readonly string[]): string[] {
  const out: string[] = []
  for (const t of types) {
    const label = EXERCISE_KIND_LABEL[t]
    if (label && !out.includes(label)) out.push(label)
  }
  return out
}

/** Số câu được chấm (chọn đáp án, điền chỗ trống) đã trả lời — cho thanh tiến độ "n/N". */
export function answeredScored(
  exercises: readonly { id: string; type: string }[],
  answers: Readonly<Record<string, { choice?: number; text?: string } | undefined>>,
): number {
  let n = 0
  for (const e of exercises) {
    const a = answers[e.id]
    if (e.type === 'MULTIPLE_CHOICE' && a?.choice !== undefined) n++
    else if (e.type === 'FILL_BLANK' && (a?.text ?? '').trim().length > 0) n++
  }
  return n
}

// ── Luyện 4 kỹ năng (mẫu `skills4`) ──────────────────────────────────────────

/** Số câu đã làm của một kỹ năng (đã chọn, đã gõ, đã ghi âm). */
export function skillAnswered(skill: SkillKey, itemCount: number, answers: Readonly<Record<string, SkillAnswer>>): number {
  let n = 0
  for (let i = 0; i < itemCount; i++) {
    const v = answers[answerKey(skill, i)]
    if (typeof v === 'number' || (typeof v === 'string' && v.trim().length > 0)) n++
  }
  return n
}

// ── Từ vựng (mẫu `vocab`) ────────────────────────────────────────────────────

export function vocabStatusLabel(status: 'NEW' | 'LEARNING' | 'REVIEWING' | 'MASTERED' | null | undefined): string | null {
  switch (status) {
    case 'NEW':
      return 'Mới'
    case 'LEARNING':
    case 'REVIEWING':
      return 'Đang học'
    case 'MASTERED':
      return 'Đã thuộc'
    default:
      return null
  }
}

// ── Sửa lỗi (mẫu `errors`) ───────────────────────────────────────────────────

export interface SentenceDiff {
  before: string
  wrong: string
  right: string
  after: string
}

/**
 * Tách câu sai và câu đúng thành phần chung đầu, đoạn khác nhau ở giữa, phần chung cuối (theo từ),
 * để gạch chân đúng chỗ sai như mẫu. Trả `null` khi thiếu câu hoặc hai câu giống hệt.
 */
export function diffMiddle(wrong: string | null | undefined, right: string | null | undefined): SentenceDiff | null {
  const w = (wrong ?? '').trim().split(/\s+/).filter(Boolean)
  const r = (right ?? '').trim().split(/\s+/).filter(Boolean)
  if (w.length === 0 || r.length === 0) return null
  let p = 0
  while (p < w.length && p < r.length && w[p] === r[p]) p++
  if (p === w.length && p === r.length) return null
  let s = 0
  while (s < w.length - p && s < r.length - p && w[w.length - 1 - s] === r[r.length - 1 - s]) s++
  const join = (xs: string[]) => xs.join(' ')
  return {
    before: join(w.slice(0, p)),
    wrong: join(w.slice(p, w.length - s)),
    right: join(r.slice(p, r.length - s)),
    after: join(w.slice(w.length - s)),
  }
}

/** Dòng phụ dưới câu sai: "Mắc 3 lần · chu kỳ 2 ngày". */
export function errorMetaLine(count: number, intervalDays?: number | null): string {
  return `Mắc ${count} lần${intervalDays != null ? ` · chu kỳ ${intervalDays} ngày` : ''}`
}
