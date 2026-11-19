// Logic thuần cho cụm thi nói telc trên app (giao diện v3.4, Đợt 5 phần B, 19/11/2026):
// kiểm micro, phòng thi ba người, thẻ đề có ý đã bàn, tự dừng khi im, phiếu kết quả.
// Không import component — jest (ts-jest, môi trường node) chạy được trực tiếp.

import type { BlueprintSummary, ExamResultView, ScoreSheet } from './examSpeakingApi'
import type { Verdict } from './examSpeakingUi'

// ── Kiểm micro một lần mỗi lần mở app ───────────────────────────────────────

let micCheckedThisRun = false

/** Đã qua màn kiểm micro trong lần mở app này chưa (mẫu v3.4 `oralmic`: "Làm một lần trước khi vào phòng"). */
export function isMicCheckedThisRun(): boolean {
  return micCheckedThisRun
}

export function markMicChecked(): void {
  micCheckedThisRun = true
}

// ── Lệnh đổi phiên chạy nối đuôi ────────────────────────────────────────────

/**
 * Hàng đợi tuần tự: mỗi lệnh chỉ bắt đầu khi lệnh trước xong (thành công hay lỗi). Phòng chuẩn bị
 * dùng cho lưu ghi chú / chọn chủ đề / vào thi — backend lưu cả dòng phiên, không khoá phiên bản,
 * nên hai lệnh chồng nhau thì lệnh về sau ghi đè trạng thái lệnh kia vừa đổi.
 */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve()
  return {
    run<T>(op: () => Promise<T>): Promise<T> {
      const next = tail.catch(() => undefined).then(op)
      tail = next
      return next
    },
  }
}

/** Ghi chú hiện trong phòng thi: lưu lỗi thì bản trên máy (mới hơn) thắng; không thì bản server, rỗng thì bản máy. */
export function roomNotes(serverNotes: string | null | undefined, localNotes: string, saveFailed: boolean): string | null {
  const local = localNotes.trim()
  if (saveFailed && local) return local
  return serverNotes?.trim() || local || null
}

// ── Mức âm micro ─────────────────────────────────────────────────────────────

/** expo-audio trả `metering` theo dBFS (−160 = im tuyệt đối, 0 = đỉnh). Dưới mức này coi như im. */
export const METER_FLOOR_DB = -55
/** Từ mức này trở lên vẽ đầy thanh. */
export const METER_CEIL_DB = -12

/** dBFS → 0…1 cho thanh đo; thiếu số (máy không hỗ trợ đo) thì 0. */
export function meterLevel(db: number | null | undefined): number {
  if (typeof db !== 'number' || !Number.isFinite(db)) return 0
  if (db <= METER_FLOOR_DB) return 0
  if (db >= METER_CEIL_DB) return 1
  return (db - METER_FLOOR_DB) / (METER_CEIL_DB - METER_FLOOR_DB)
}

/** Ngưỡng 0…1 coi là có tiếng nói (≈ −42 dBFS) — cao hơn tiếng ồn phòng, thấp hơn giọng nói thường. */
export const SPEECH_LEVEL = 0.3

/** Số vạch sáng trên thanh đo `bars` vạch. */
export function litBars(level: number, bars: number): number {
  return Math.max(0, Math.min(bars, Math.round(level * bars)))
}

// ── Tự dừng khi im (bản sinh đôi `frontend/src/lib/exam/silenceDetector.ts`) ─────────────

export const AUTO_STOP_SILENCE_MS = 2000

/**
 * Chỉ dừng khi ĐÃ nghe thấy người nói rồi mới im liền `silenceMs` — bấm micro rồi nghĩ vài giây
 * trước khi nói thì không bị cắt. Máy không trả mức âm thì không bao giờ "nghe thấy" → không tự
 * dừng, người học bấm tay như cũ (hỏng an toàn).
 */
export function createSilenceDetector({
  silenceMs = AUTO_STOP_SILENCE_MS,
  threshold = SPEECH_LEVEL,
  minSpeechMs = 300,
}: { silenceMs?: number; threshold?: number; minSpeechMs?: number } = {}) {
  let speechMs = 0
  let lastAt: number | null = null
  let lastLoudAt: number | null = null
  return {
    /** Một mẫu mức âm 0…1; trả `true` khi nên dừng ghi. */
    update(level: number, now: number): boolean {
      const dt = lastAt == null ? 0 : Math.max(0, now - lastAt)
      lastAt = now
      if (level >= threshold) {
        speechMs += dt
        lastLoudAt = now
        return false
      }
      return speechMs >= minSpeechMs && lastLoudAt != null && now - lastLoudAt >= silenceMs
    },
  }
}

// ── Thẻ đề: các ý cần bàn ────────────────────────────────────────────────────

/** Ý trên thẻ đề (`stimulus.prompts`) — telc B1 Teil 3 (Planen) và các thẻ tình huống. Không có thì rỗng. */
export function taskPrompts(stimulus: Record<string, unknown> | null | undefined): string[] {
  const v = stimulus?.prompts
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim())
}

/** Số ý đã bàn, chỉ đếm chỉ số hợp lệ và không trùng. */
export function coveredCount(prompts: readonly string[], covered: readonly number[] | null | undefined): number {
  const set = new Set((covered ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i < prompts.length))
  return set.size
}

// ── Thứ tự Teil và tiến độ ───────────────────────────────────────────────────

export type StageState = 'done' | 'current' | 'todo'

export function teilStages(totalParts: number, currentPart: number): { teilNo: number; state: StageState }[] {
  const n = Math.max(1, totalParts)
  return Array.from({ length: n }, (_, i) => {
    const teilNo = i + 1
    return { teilNo, state: teilNo < currentPart ? 'done' : teilNo === currentPart ? 'current' : 'todo' }
  })
}

/** Phút hiển thị cho một Teil (làm tròn, tối thiểu 1). */
export function partMinutes(durationSec: number): number {
  return Math.max(1, Math.round(durationSec / 60))
}

/** Blueprint đúng hệ + cấp của phiên (để lấy tên Teil, thời lượng, ngưỡng đỗ). */
export function findBlueprint(
  list: readonly BlueprintSummary[] | undefined,
  provider: string | undefined,
  level: string | undefined,
): BlueprintSummary | undefined {
  if (!list || !provider || !level) return undefined
  return list.find((b) => b.provider === provider && b.level === level)
}

// ── Ai đang nói ──────────────────────────────────────────────────────────────

export type OralSpeaker = 'PRUEFER' | 'PARTNER' | 'ME' | null

export function oralSpeaker(aiSpeaking: string | null, recording: boolean): OralSpeaker {
  if (aiSpeaking === 'PRUEFER' || aiSpeaking === 'PARTNER') return aiSpeaking
  return recording ? 'ME' : null
}

/** Dòng trạng thái trên nút micro. */
export function micStatus(opts: { recording: boolean; uploading: boolean; aiSpeaking: string | null; busy: boolean }): string {
  if (opts.uploading) return 'Đang gửi · giám khảo đang nghe'
  if (opts.recording) return 'Đang nghe bạn nói'
  if (opts.aiSpeaking === 'PARTNER') return 'Bạn thi đang nói'
  if (opts.aiSpeaking === 'PRUEFER') return 'Giám khảo đang nói'
  if (opts.busy) return 'Đang chuyển…'
  return 'Đến lượt bạn · bấm micro để nói'
}

// ── Phiếu kết quả ────────────────────────────────────────────────────────────

/** Tiêu đề kết quả: phần trước, chữ có vệt vàng, phần sau. */
export function resultHeadline(v: Verdict): { before: string; mark: string; after: string } {
  switch (v) {
    case 'PASS':
      return { before: 'Phần nói', mark: 'đủ điểm', after: 'đỗ' }
    case 'BORDERLINE':
      return { before: 'Phần nói', mark: 'sát ngưỡng', after: 'đỗ' }
    case 'FAIL':
      return { before: 'Phần nói', mark: 'chưa đủ', after: 'điểm đỗ' }
    default:
      return { before: 'Kết quả', mark: 'phần nói', after: '' }
  }
}

/** Nhãn ô huy hiệu cạnh điểm: điểm luôn là ước tính (beta). */
export function resultBadge(v: Verdict): string {
  switch (v) {
    case 'PASS':
      return 'Ước tính · Đủ điểm'
    case 'BORDERLINE':
      return 'Ước tính · Sát ngưỡng'
    case 'FAIL':
      return 'Ước tính · Chưa đủ'
    default:
      return 'Ước tính'
  }
}

export interface ResultRow {
  key: string
  badge: string
  title: string
  note: string | null
  points: number
  max: number
  /** Thấp hơn 60 % số điểm tối đa — tô cam. */
  low: boolean
}

/**
 * Hàng "Điểm từng phần" như mẫu `oralres`: mỗi Teil (tên lấy từ blueprint, nhận xét của giám khảo)
 * rồi các tiêu chí chung (phát âm…). Tiêu chí chưa chấm được thì bỏ.
 */
export function resultRows(sheet: ScoreSheet, bp?: Pick<BlueprintSummary, 'parts'>): ResultRow[] {
  const titleOf = (teilNo: number) => bp?.parts.find((p) => p.teilNo === teilNo)?.title ?? `Teil ${teilNo}`
  const parts: ResultRow[] = sheet.parts.map((p) => ({
    key: `T${p.teilNo}`,
    badge: `T${p.teilNo}`,
    title: titleOf(p.teilNo),
    note: p.comment?.trim() || null,
    points: p.points,
    max: p.max,
    low: p.max > 0 && p.points / p.max < 0.6,
  }))
  const global: ResultRow[] = sheet.global
    .filter((g) => g.scored)
    .map((g) => ({
      key: `G-${g.code}`,
      badge: (g.label || g.code).trim().charAt(0).toUpperCase() || '·',
      title: g.label || g.code,
      note: g.evidence?.find((e) => e && e.trim())?.trim() ?? null,
      points: g.points,
      max: g.max,
      low: g.max > 0 && g.points / g.max < 0.6,
    }))
  return [...parts, ...global]
}

/** Thanh điểm: tỉ lệ điểm và vị trí vạch ngưỡng đỗ (0…1); thiếu số thì null. */
export function scoreBar(
  r: Pick<ExamResultView, 'total' | 'max'>,
  passMin: number | null | undefined,
): { ratio: number; mark: number | null } {
  const max = r.max ?? 0
  const ratio = max > 0 && r.total != null ? Math.max(0, Math.min(1, r.total / max)) : 0
  const mark = max > 0 && passMin != null && passMin > 0 ? Math.max(0, Math.min(1, passMin / max)) : null
  return { ratio, mark }
}

/** Câu dưới thanh điểm: cần bao nhiêu, hai lượt chấm cho dải nào. */
export function scoreNote(
  r: Pick<ExamResultView, 'totalLow' | 'totalHigh'>,
  passMin: number | null | undefined,
  v: Verdict,
): string | null {
  const parts: string[] = []
  if (passMin != null && passMin > 0) parts.push(`Cần ${Math.round(passMin)} để đỗ phần nói.`)
  if (r.totalLow != null && r.totalHigh != null) {
    const range = `${Math.round(r.totalLow)}–${Math.round(r.totalHigh)}`
    parts.push(v === 'BORDERLINE' ? `Hai lượt chấm cho ${range} điểm, vắt qua ngưỡng đỗ.` : `Hai lượt chấm cho ${range} điểm.`)
  }
  return parts.length ? parts.join(' ') : null
}

// ── Xem lại hội thoại ────────────────────────────────────────────────────────

export interface TranscriptLine {
  teilNo: number
  seq: number
  role: string
  text: string
}

/** Gom hội thoại theo Teil, theo thứ tự lời; bỏ lời rỗng. */
export function transcriptByTeil(lines: readonly TranscriptLine[]): { teilNo: number; lines: TranscriptLine[] }[] {
  const byTeil = new Map<number, TranscriptLine[]>()
  for (const l of [...lines].sort((a, b) => a.teilNo - b.teilNo || a.seq - b.seq)) {
    if (!l.text?.trim()) continue
    const list = byTeil.get(l.teilNo) ?? []
    byTeil.set(l.teilNo, [...list, l])
  }
  return [...byTeil.entries()].map(([teilNo, ls]) => ({ teilNo, lines: ls }))
}

export function speakerName(role: string): string {
  if (role === 'CANDIDATE') return 'Bạn'
  if (role === 'PARTNER') return 'Bạn thi'
  return 'Giám khảo'
}
