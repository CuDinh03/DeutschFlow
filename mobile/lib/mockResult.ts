// Phép thuần của màn kết quả thi thử trọn đề (Đợt 4b, 19/11/2026). Bản sinh đôi của web
// `components/exam/mock/mockModel.ts` (gateView, lostRows) + `ResultSummary.tsx` (câu tiêu đề) +
// `lib/exam/mockAttemptApi.ts` (sectionScores). Không gọi API, không import giao diện.

import type { ExamBudget, ExamGate } from './examApi'
import { formatPoints } from './examApi'
import type { PracticeItemResult, PracticeTeilResult } from './telcPracticeApi'

export interface GateView {
  raw: number
  max: number
  min: number
  status: string
  /** raw − min, làm tròn 0,1; `null` khi chưa thi. */
  margin: number | null
  /** 0–1. */
  ratio: number
  /** Vị trí vạch ngưỡng, 0–1. */
  markRatio: number
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
    ratio: g.max > 0 ? Math.min(1, Math.max(0, g.raw / g.max)) : 0,
    markRatio: g.max > 0 ? Math.min(1, Math.max(0, g.min / g.max)) : 0.6,
  }
}

/** Tiêu đề kết luận, tách phần có vệt bút vàng: "Đỗ phần viết, hơn ngưỡng" + "12 điểm". */
export interface Headline {
  before: string
  mark: string
  after?: string
}

export function resultHeadline(gates: ExamGate[] | undefined, score: number, passed?: boolean | null): Headline {
  const w = gateView(gates, 'written')
  if (w && w.margin != null) {
    if (w.margin > 0) return { before: 'Đỗ phần viết, hơn ngưỡng', mark: `${formatPoints(w.margin)} điểm` }
    if (w.margin === 0) return { before: 'Đỗ phần viết,', mark: 'vừa đúng ngưỡng' }
    return { before: 'Còn thiếu', mark: `${formatPoints(-w.margin)} điểm`, after: 'phần viết' }
  }
  if (passed === true) return { before: 'Bạn đã', mark: 'đỗ', after: `với ${formatPoints(score)} điểm` }
  return { before: 'Đã chấm xong:', mark: `${formatPoints(score)} điểm` }
}

/** "Ước tính · Đỗ" / "Ước tính · Chưa đỗ" — điểm Viết/Nói do AI chấm, không phải điểm chính thức. */
export function gateBadge(g: GateView): { label: string; tone: 'success' | 'danger' } | null {
  if (g.status === 'PASSED') return { label: 'Ước tính · Đỗ', tone: 'success' }
  if (g.status === 'FAILED') return { label: 'Ước tính · Chưa đỗ', tone: 'danger' }
  return null
}

export interface LostRow {
  /** Khoá Teil để mở phân tích (`LESEN-2`, `SCHREIBEN-1`). */
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

const SECTION_DE: Record<string, string> = {
  LESEN: 'Lesen',
  SPRACHBAUSTEINE: 'Sprachbausteine',
  HOEREN: 'Hören',
  SCHREIBEN: 'Schreiben',
  SPRECHEN: 'Sprechen',
}

/** Tên phần tiếng Đức như đề giấy; mã lạ thì "Phần khác" (mã máy không lộ ra giao diện). */
export const sectionDe = (section: string): string => SECTION_DE[section] ?? 'Phần khác'

/** "Hören Teil 2"; phần Viết một Teil thì chỉ "Schreiben". */
export function teilName(section: string, teil: number): string {
  return section === 'SCHREIBEN' ? 'Schreiben' : `${sectionDe(section)} Teil ${teil}`
}

/** Khoá Teil `LESEN-2` → tên đọc được. */
export function teilNameOfKey(key: string): string {
  const m = /^([A-Z_]+)-(\d+)$/.exec(key)
  return m ? teilName(m[1], Number(m[2])) : 'Teil'
}

/** Dòng phụ của một chỗ mất điểm. */
export function lostReason(r: LostRow, writing: { text: string | null; missingPoints: number } | null): string {
  if (r.section === 'SCHREIBEN') {
    if (!writing?.text?.trim()) return 'Chưa viết bài'
    return writing.missingPoints > 0 ? `Thiếu ${writing.missingPoints} ý bắt buộc` : 'Mất điểm ở cách viết thư'
  }
  if (r.wrong != null && r.items != null) {
    return `Sai ${r.wrong}/${r.items} ${r.section === 'SPRACHBAUSTEINE' ? 'chỗ trống' : 'câu'}`
  }
  return 'Mất điểm ở Teil này'
}

export const lostLabel = (lost: number): string => `−${formatPoints(lost)}`

export interface SectionScoreRow {
  section: string
  label: string
  total: number
  max: number
}

const SCORE_ORDER = ['LESEN', 'SPRACHBAUSTEINE', 'HOEREN', 'SCHREIBEN', 'SPRECHEN']

/** Điểm từng phần đọc từ `detailed_scores_json` của lượt thi (chỉ các khoá có `max`). */
export function sectionScoreRows(detailedJson: string | null | undefined): SectionScoreRow[] {
  if (!detailedJson) return []
  try {
    const parsed = JSON.parse(detailedJson) as Record<string, { total?: unknown; max?: unknown }>
    const rows: SectionScoreRow[] = []
    for (const [k, v] of Object.entries(parsed ?? {})) {
      if (!v || typeof v !== 'object' || typeof v.max !== 'number' || !(k in SECTION_DE)) continue
      rows.push({ section: k, label: sectionDe(k), total: typeof v.total === 'number' ? v.total : 0, max: v.max })
    }
    return rows.sort((a, b) => SCORE_ORDER.indexOf(a.section) - SCORE_ORDER.indexOf(b.section))
  } catch {
    return []
  }
}

export interface AnalysisRow {
  key: string
  name: string
  section: string
  /** "4/5 câu đúng" · "27/45 điểm" · "Đang chờ chấm". */
  meta: string
  /** Có câu (hoặc phiếu chấm Viết) để mở xem lại. */
  openable: boolean
}

/**
 * Hàng "Phân tích từng câu": mỗi Teil khách quan một hàng (số câu đúng), bài viết một hàng (điểm hoặc
 * đang chờ chấm). Thứ tự theo phân tích server trả (đúng thứ tự đề).
 */
export function analysisRows(
  teile: readonly PracticeTeilResult[],
  writing: { status?: string | null; total?: number | null; max?: number | null } | null,
  writingScore?: { total: number; max: number } | null,
): AnalysisRow[] {
  const rows: AnalysisRow[] = teile.map((t) => {
    const m = /^([A-Z_]+)-(\d+)$/.exec(t.teilKey)
    const section = m?.[1] ?? ''
    return {
      key: t.teilKey,
      name: teilNameOfKey(t.teilKey),
      section,
      meta: `${t.correctCount}/${t.total} ${section === 'SPRACHBAUSTEINE' ? 'chỗ trống đúng' : 'câu đúng'}`,
      openable: t.items.length > 0,
    }
  })
  if (writing) {
    const pending = writing.status === 'PENDING_AI_EVALUATION'
    const total = writingScore?.total ?? writing.total ?? null
    const max = writingScore?.max ?? writing.max ?? null
    rows.push({
      key: 'SCHREIBEN-1',
      name: 'Schreiben',
      section: 'SCHREIBEN',
      meta: pending || total == null ? 'Đang chờ chấm' : `${formatPoints(total)}${max != null ? `/${formatPoints(max)}` : ''} điểm`,
      // Phiếu chấm Viết (điểm từng tiêu chí, lỗi, bài mẫu) mở được khi AI đã chấm xong.
      openable: !pending && writing.total != null,
    })
  }
  return rows
}

/** Bản đồ câu trả lời đã nộp của một Teil (để dựng lại đề ở chế độ xem lại). */
export function givenAnswers(items: readonly PracticeItemResult[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const it of items) if (it.given) out[it.id] = it.given
  return out
}

/** "dd/mm" của một mốc ISO; mốc hỏng thì chuỗi rỗng. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}
