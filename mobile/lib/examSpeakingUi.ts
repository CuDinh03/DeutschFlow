// Helpers THUẦN cho các màn Luyện thi Nói — tách khỏi screen để test được
// (quyết định hiển thị trạng thái/đồng hồ/điểm không được phép sống vô danh
// trong JSX — bài học F-1 onboarding: logic trong màn không test là logic gãy êm).

import type { BlueprintSummary, ExamSessionState, ExamProvider, WeakPointView } from './examSpeakingApi'

/** Thứ tự trình độ để sort chip level trên hub. */
const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

/** Danh sách level duy nhất có blueprint, xếp A1→C2. */
export function levelsFromBlueprints(list: readonly Pick<BlueprintSummary, 'level'>[]): string[] {
  const seen = new Set<string>()
  for (const b of list) seen.add(b.level.toUpperCase())
  return [...seen].sort((a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b))
}

/**
 * Giây còn lại của một deadline SERVER, neo theo đồng hồ server:
 * offset = serverNow(lúc nhận snapshot) − clientNow(lúc nhận) — về sau chỉ cần
 * clientNow hiện tại. Đồng hồ máy người dùng lệch bao nhiêu cũng không sai giờ thi.
 */
export function remainingSec(
  deadlineAt: string | null,
  serverNowAtFetch: string,
  clientNowAtFetchMs: number,
  clientNowMs: number,
): number | null {
  if (!deadlineAt) return null
  const deadline = new Date(deadlineAt).getTime()
  const serverAtFetch = new Date(serverNowAtFetch).getTime()
  if (!Number.isFinite(deadline) || !Number.isFinite(serverAtFetch)) return null
  const serverNowEst = serverAtFetch + (clientNowMs - clientNowAtFetchMs)
  return Math.max(0, Math.ceil((deadline - serverNowEst) / 1000))
}

/** mm:ss cho đồng hồ thi. */
export function formatClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Nhãn tiếng Việt cho trạng thái phiên — dùng ở pill/heading, không rẽ nhánh logic. */
export function stateLabel(state: ExamSessionState): string {
  switch (state) {
    case 'PREP': return 'Chuẩn bị'
    case 'IN_PART': return 'Đang thi'
    case 'BETWEEN': return 'Giữa hai phần'
    case 'DONE': return 'Đã nói xong'
    case 'GRADING': return 'Đang chấm'
    case 'RESULTS': return 'Có kết quả'
    case 'GRADING_FAILED': return 'Chấm lỗi'
    case 'ABORTED': return 'Đã huỷ'
    default: return state
  }
}

/**
 * `directive.prueferText` là ECHO lời PRUEFER GẦN NHẤT trong Teil (backend
 * ExamSessionService.view: lastPruefer.getTranscript()) — nó lặp NGUYÊN VĂN qua
 * mọi step của Teil và trùng với lượt PRUEFER vừa tới qua `aiTurns`. Chỉ hiển
 * thị khi transcript CHƯA có nó ở vị trí lời-giám-khảo-cuối: lúc mới vào
 * màn/Teil, hoặc khi giám khảo thật sự nói câu mới. Trả về text (đã trim) khi
 * cần hiển thị, null khi là bản lặp — sửa lỗi "giám khảo hiện 2 lần câu hỏi
 * mỗi khi partner trả lời" (QA TestFlight 02/09).
 */
export function nextPrueferAnnouncement(
  lastShownPruefer: string | null,
  directiveText: string | null | undefined,
): string | null {
  const next = directiveText?.trim()
  if (!next) return null
  if (lastShownPruefer !== null && lastShownPruefer.trim() === next) return null
  return next
}

/** Phần trăm 0..1 an toàn cho thanh điểm tiêu chí. */
export function criterionRatio(points: number, max: number): number {
  if (!Number.isFinite(points) || !Number.isFinite(max) || max <= 0) return 0
  return Math.min(1, Math.max(0, points / max))
}

/**
 * Tông màu semantic cho một tỉ lệ điểm — ngưỡng theo design canvas 02/09:
 * ≥0.85 xanh (tốt), ≥0.72 vàng đậm (ổn), còn lại cam (cần kéo).
 */
export function ratioTone(ratio: number): 'success' | 'gold' | 'orange' {
  if (ratio >= 0.85) return 'success'
  if (ratio >= 0.72) return 'gold'
  return 'orange'
}

/**
 * Rút phần hiển thị được từ một `stimulus` (map tự do theo archetype backend —
 * web StimulusCard render ~10 kiểu; mobile MVP hiển thị các khoá phổ biến và
 * degrade êm với kiểu lạ: headline + gạch đầu dòng nếu có).
 */
export interface StimulusDisplay {
  headline: string | null
  bullets: string[]
}

export function stimulusDisplay(stimulus: Record<string, unknown> | null | undefined): StimulusDisplay {
  if (!stimulus) return { headline: null, bullets: [] }
  const s = stimulus as Record<string, unknown>
  const first = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = s[k]
      if (typeof v === 'string' && v.trim()) return v
      if (typeof v === 'number') return String(v)
    }
    return null
  }
  const headline = first('thema', 'prompt', 'keyword', 'wort', 'questionWord', 'situation', 'spell', 'number', 'title')
  const bullets: string[] = []
  for (const k of ['keywords', 'hints', 'points', 'bullets']) {
    const v = s[k]
    if (Array.isArray(v)) for (const item of v) if (typeof item === 'string') bullets.push(item)
  }
  return { headline, bullets }
}

/** Giọng TTS theo vai trong phòng thi — đồng bộ web examTts.ts. */
export const EXAM_VOICE_BY_ROLE: Record<string, string> = {
  PRUEFER: 'ANNA',
  PARTNER: 'THOMAS',
}

export interface DrillTarget {
  provider: ExamProvider
  level: string
  teilNo: number
  archetype: string
  count: number
}

/**
 * Gom `contexts` của các lỗi hay mắc (WeaknessView) thành mục tiêu drill theo
 * provider + level + Teil, cộng dồn số lần, sắp nhiều → ít (hoà thì level thấp
 * trước, Teil nhỏ trước), cắt `limit`. Web làm cùng phép gom ở màn weakness
 * (N3, đợt 2 plan nâng cấp mobile 05/09) — mobile trước đây là ngõ cụt chỉ có nút
 * quay lại.
 */
export function drillTargets(
  weakPoints: readonly Pick<WeakPointView, 'contexts'>[],
  limit = 4,
): DrillTarget[] {
  const byKey = new Map<string, DrillTarget>()
  for (const w of weakPoints) {
    for (const ctx of w.contexts ?? []) {
      if (!ctx.level || !(ctx.teilNo > 0)) continue
      const n = Math.max(1, ctx.count ?? 1)
      const key = `${ctx.provider}|${ctx.level}|${ctx.teilNo}`
      const cur = byKey.get(key)
      byKey.set(
        key,
        cur
          ? { ...cur, count: cur.count + n }
          : { provider: ctx.provider, level: ctx.level, teilNo: ctx.teilNo, archetype: ctx.archetype, count: n },
      )
    }
  }
  return [...byKey.values()]
    .sort(
      (a, b) =>
        b.count - a.count ||
        LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) ||
        a.teilNo - b.teilNo,
    )
    .slice(0, Math.max(0, limit))
}

// ── Đợt parity 05/09 (drill chấm nhanh, sát ngưỡng, hết quota, retry idempotent) ─────────────

/** Chấm nhanh một lượt DRILL do backend trả (`TurnResponse.turnEval`) — cùng shape với web. */
export interface DrillTurnEval {
  score?: number
  feedbackVi?: string
  corrections?: { code: string; original: string; correction: string; severity?: string }[]
  redemittel?: string[]
  error?: string
}

export interface DrillSummary {
  turns: number
  avgScore: number | null
  /** Lỗi cần xem lại, khử trùng theo câu gốc (giữ lần cuối). */
  corrections: { code: string; original: string; correction: string }[]
}

/** Tổng kết drill cho màn DONE (web `DrillSummary`): trung bình điểm các lượt có điểm + gom lỗi. */
export function drillSummary(evals: readonly (DrillTurnEval | null | undefined)[]): DrillSummary {
  const scored = evals.filter((e): e is DrillTurnEval => !!e && typeof e.score === 'number')
  const avg = scored.length ? scored.reduce((s, e) => s + (e.score ?? 0), 0) / scored.length : null
  const byOriginal = new Map<string, { code: string; original: string; correction: string }>()
  for (const e of scored) {
    for (const c of e.corrections ?? []) {
      if (!c.original?.trim()) continue
      byOriginal.set(c.original.trim().toLowerCase(), { code: c.code, original: c.original, correction: c.correction })
    }
  }
  return { turns: scored.length, avgScore: avg === null ? null : Math.round(avg * 10) / 10, corrections: [...byOriginal.values()] }
}

export type Verdict = 'PASS' | 'FAIL' | 'BORDERLINE' | 'NONE'

/** Kết luận hiển thị: sát ngưỡng thắng đỗ/trượt (F-17); không ngưỡng (A1) → NONE. */
export function verdict(r: { passed: boolean | null; borderline?: boolean | null }): Verdict {
  if (r.borderline) return 'BORDERLINE'
  if (r.passed === true) return 'PASS'
  if (r.passed === false) return 'FAIL'
  return 'NONE'
}

export function verdictLabel(v: Verdict): string {
  switch (v) {
    case 'PASS': return 'ĐỦ ĐIỂM ĐỖ'
    case 'FAIL': return 'CHƯA ĐỦ ĐIỂM'
    case 'BORDERLINE': return 'SÁT NGƯỠNG'
    default: return 'ĐÃ CHẤM'
  }
}

export function verdictTone(v: Verdict): 'success' | 'danger' | 'accent' | 'neutral' {
  switch (v) {
    case 'PASS': return 'success'
    case 'FAIL': return 'danger'
    case 'BORDERLINE': return 'accent'
    default: return 'neutral'
  }
}

export function providerName(p: ExamProvider | string): string {
  return p === 'TELC' ? 'telc' : 'Goethe'
}

/** Nhãn bộ tiêu chí theo hệ — trước đây hard-code "Goethe" dù phiên telc. */
export function rubricCaption(p: ExamProvider | string): string {
  return p === 'TELC' ? 'Theo tiêu chí telc (A–D)' : 'Theo tiêu chí Goethe'
}

/** Thông điệp màn GRADING_FAILED theo lý do backend (F-08): hết quota ≠ job chết. */
export function gradingFailedCopy(gradingError?: string | null): { title: string; message: string; topUp: boolean } {
  if (gradingError === 'QUOTA_EXCEEDED') {
    return {
      title: 'Chưa chấm được: hết ngân sách AI',
      message: 'Bài nói của bạn vẫn còn nguyên. Nạp thêm hoặc chờ kỳ mới rồi bấm "Chấm lại" — không phải thi lại.',
      topUp: true,
    }
  }
  return {
    title: 'Chấm bài gặp lỗi',
    message: 'Bài nói của bạn vẫn còn nguyên — chỉ khâu chấm bị lỗi. Bấm chấm lại, không phải thi lại.',
    topUp: false,
  }
}

/** Khoá idempotency một lượt nói (F-06) — sinh một lần, dùng lại nguyên khoá khi "Gửi lại". */
export function newClientTurnId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Lượt nói thất bại mà server CÓ THỂ đã xử lý → giữ file + khoá để gửi lại cùng khoá. Không có
 * response (timeout/mất mạng), 5xx, hoặc 409 "đang được xử lý" là gửi lại được; 4xx khác thì không.
 */
export function isRetryableTurnError(e: unknown): boolean {
  const status = (e as { response?: { status?: number } } | null)?.response?.status
  if (!status) return true
  if (status >= 500) return true
  if (status !== 409) return false
  const detail = (e as { response?: { data?: { detail?: unknown; message?: unknown } } }).response?.data
  const text = String(detail?.detail ?? detail?.message ?? '')
  return /đang được xử lý|in progress/i.test(text)
}
