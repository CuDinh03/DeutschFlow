// Phép thuần của màn đang thi thử trọn đề (`exam-attempt.tsx`, Đợt 4b, 19/11/2026): đồng hồ theo giờ
// server, tự lưu nháp lên máy chủ, chặng thi telc. Không gọi API, không import giao diện (jest chạy node).
//
// Hợp đồng server (`MockExamController`, V285): `/start` và mỗi lần `PATCH …/draft` thành công trả
// `server_now` + `deadline_at` + `remaining_seconds`. Nháp khoá lạc quan bằng `baseVersion`: lệch ⇒ 409
// kèm bản nháp mới nhất; quá hạn + 120 giây ân hạn ⇒ 410 (client phải nộp). Bản sinh đôi của web ở
// `frontend/src/lib/exam/examDraftSync.ts` — luật lưu nháp hai bên phải giống nhau.

import { remainingSec } from './examSpeakingUi'

// ─── đồng hồ ─────────────────────────────────────────────────────────────────

/** Mốc neo đồng hồ: điều server nói lúc nhận + giờ máy lúc nhận. */
export interface ClockAnchor {
  deadlineAt: string | null
  serverNow: string | null
  remainingSeconds: number | null
  clientAtMs: number
}

/** Phần thân của `/start` và của `PATCH …/draft` 200 mang thông tin giờ. */
export interface ServerClockBody {
  deadline_at?: string | null
  server_now?: string | null
  remaining_seconds?: number | null
}

/** Neo đồng hồ từ thân trả về của server; `null` khi đề không giới hạn giờ (server bỏ `deadline_at`). */
export function anchorFromServer(body: ServerClockBody | null | undefined, clientAtMs: number): ClockAnchor | null {
  if (!body) return null
  const deadlineAt = typeof body.deadline_at === 'string' ? body.deadline_at : null
  const remaining = typeof body.remaining_seconds === 'number' && Number.isFinite(body.remaining_seconds) ? body.remaining_seconds : null
  if (deadlineAt == null && remaining == null) return null
  return {
    deadlineAt,
    serverNow: typeof body.server_now === 'string' ? body.server_now : null,
    remainingSeconds: remaining,
    clientAtMs,
  }
}

/**
 * Giây còn lại theo giờ server. Ưu tiên `deadline_at` − `server_now` (như phòng thi nói), không đọc được
 * thì lấy `remaining_seconds` trừ thời gian đã trôi trên máy. Đồng hồ máy lệch bao nhiêu cũng không sai,
 * vì chỉ dùng khoảng chênh của chính máy từ lúc nhận.
 */
export function secondsLeft(anchor: ClockAnchor | null, nowMs: number): number | null {
  if (!anchor) return null
  if (anchor.deadlineAt && anchor.serverNow) {
    const left = remainingSec(anchor.deadlineAt, anchor.serverNow, anchor.clientAtMs, nowMs)
    if (left != null) return left
  }
  if (anchor.remainingSeconds == null) return null
  return Math.max(0, Math.ceil(anchor.remainingSeconds - (nowMs - anchor.clientAtMs) / 1000))
}

/** `1:12:20` khi còn từ một giờ, `4:05` khi dưới một giờ. */
export function formatExamClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mmss = `${String(m).padStart(h > 0 ? 2 : 1, '0')}:${String(sec).padStart(2, '0')}`
  return h > 0 ? `${h}:${mmss}` : mmss
}

/** Nhãn đọc cho VoiceOver: "còn 1 giờ 12 phút", "còn 4 phút", "còn 30 giây". */
export function clockSpoken(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  if (s < 60) return `còn ${s} giây`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `còn ${h} giờ ${m} phút` : `còn ${m} phút`
}

export type ClockTone = 'normal' | 'warn' | 'danger'

/** Năm phút cuối đổi màu cảnh báo, phút cuối đổi màu đỏ. */
export function clockTone(totalSec: number): ClockTone {
  if (totalSec <= 60) return 'danger'
  if (totalSec <= 5 * 60) return 'warn'
  return 'normal'
}

/**
 * Hết giờ thì tự nộp — đúng MỘT lần, và chỉ khi người học đang ở màn thi. Màn sống ẩn dưới Tabs: rời
 * màn rồi hết giờ thì không nộp ngầm sau lưng; quay lại màn (hoặc mở lại từ màn Đề) thì nộp ngay.
 */
export function shouldAutoSubmit(s: { secondsLeft: number | null; focused: boolean; finished: boolean; submitting: boolean; fired: boolean }): boolean {
  return s.secondsLeft === 0 && s.focused && !s.finished && !s.submitting && !s.fired
}

// ─── tự lưu nháp ─────────────────────────────────────────────────────────────

export interface DraftPayload {
  answers: Record<string, string>
  sectionIndex: number
  /** Câu "đánh dấu xem lại" (V374, chung với web). Không gửi ⇒ server giữ cờ đang lưu. */
  flags?: string[]
}

export interface ServerDraft {
  answersJson: string | null
  sectionIndex: number | null
  version: number
  /** Cờ của bản trên server; `undefined` khi server không gửi. */
  flags?: string[]
}

export type DraftSaveResult =
  | { kind: 'saved'; version: number; clock: ServerClockBody | null }
  | { kind: 'conflict'; serverVersion: number; draft: ServerDraft | null }
  /** 409 ATTEMPT_NOT_IN_PROGRESS: lượt đã nộp/đã đóng ở nơi khác. */
  | { kind: 'closed' }
  | { kind: 'expired' }
  | { kind: 'error' }

/** Thân 200 của `PATCH …/draft` → kết quả. */
export function parseDraftSaved(data: unknown, baseVersion: number): DraftSaveResult {
  const body = (data ?? {}) as { version?: unknown } & ServerClockBody
  return {
    kind: 'saved',
    version: typeof body.version === 'number' ? body.version : baseVersion + 1,
    clock: { deadline_at: body.deadline_at ?? null, server_now: body.server_now ?? null, remaining_seconds: body.remaining_seconds ?? null },
  }
}

/** Phản hồi lỗi của `PATCH …/draft` → kết quả. Không có `status` (mất mạng, hết thời gian chờ) ⇒ `error`. */
export function classifyDraftSaveError(status: number | undefined, data: unknown): DraftSaveResult {
  if (status === 410) return { kind: 'expired' }
  if (status === 409) {
    const body = (data ?? {}) as Record<string, unknown>
    if (body.error === 'ATTEMPT_NOT_IN_PROGRESS') return { kind: 'closed' }
    const raw = body.draft as Record<string, unknown> | undefined
    const sv = typeof body.server_version === 'number' ? body.server_version : Number(body.server_version ?? 0)
    const serverVersion = Number.isFinite(sv) ? sv : 0
    const draft: ServerDraft | null = raw
      ? {
          answersJson: typeof raw.answers_json === 'string' ? raw.answers_json : null,
          sectionIndex: typeof raw.section_index === 'number' ? raw.section_index : null,
          version: typeof raw.version === 'number' ? raw.version : serverVersion,
          ...(Array.isArray(raw.flags) ? { flags: parseFlags(raw.flags) } : {}),
        }
      : null
    return { kind: 'conflict', serverVersion, draft }
  }
  return { kind: 'error' }
}

/**
 * Gộp BA CHIỀU khi lệch phiên bản (soát Đợt 4b): `acked` = bản server đã xác nhận gần nhất mà máy này biết
 * (từ `/start`, rồi mỗi lần lưu thành công). Với từng câu: máy ĐÃ SỬA so với `acked` thì lấy bản máy (kể cả
 * xoá); máy chưa sửa thì lấy bản server (kể cả xoá). Vừa giữ câu chọn sau lần lưu mất phản hồi, vừa không
 * đè câu người học vừa sửa trên web (gộp hai chiều "máy thắng" làm sống lại giá trị cũ của `/start`).
 */
export function mergeConflict(
  local: Record<string, string>,
  server: Record<string, string>,
  acked: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {}
  const keys = new Set([...Object.keys(local), ...Object.keys(server), ...Object.keys(acked)])
  for (const k of keys) {
    const changedHere = local[k] !== acked[k]
    const v = changedHere ? local[k] : server[k]
    if (v !== undefined) out[k] = v
  }
  return out
}

// ─── cờ "đánh dấu xem lại" ──────────────────────────────────────────────────
// Lưu trong nháp của lượt (`draft_flags_json`, V374) như web: đánh dấu trên web thì app thấy và ngược lại.

/** Như web `parseFlags`: chỉ giữ chuỗi khác rỗng. */
export function parseFlags(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && x !== '') : []
}

/** Bật/tắt cờ của một câu; trả mảng mới. */
export function toggleFlag(flags: readonly string[], id: string): string[] {
  return flags.includes(id) ? flags.filter((x) => x !== id) : [...flags, id]
}

/**
 * Gộp ba chiều cho cờ khi lệch phiên bản — cùng luật với `mergeConflict`: câu nào máy đã bật/tắt so với
 * `acked` thì theo máy, còn lại theo server. Giữ thứ tự: cờ của server trước, cờ mới của máy sau.
 */
export function mergeFlags(local: readonly string[], server: readonly string[], acked: readonly string[]): string[] {
  const L = new Set(local)
  const A = new Set(acked)
  const keep = (id: string) => (L.has(id) !== A.has(id) ? L.has(id) : server.includes(id))
  const out: string[] = []
  for (const id of [...server, ...local, ...acked]) {
    if (!out.includes(id) && keep(id)) out.push(id)
  }
  return out
}

export const DRAFT_DEBOUNCE_MS = 2_500
export const DRAFT_MAX_INTERVAL_MS = 10_000
export const DRAFT_RETRY_MS = 10_000

export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'retrying'

export interface DraftAutosaverOptions {
  save: (payload: DraftPayload, baseVersion: number) => Promise<DraftSaveResult>
  onSaved?: (r: { version: number; clock: ServerClockBody | null }) => void
  /** Người gọi gộp rồi gọi `adoptVersion` + `notifyChange` để lưu lại bản gộp. */
  onConflict?: (r: { serverVersion: number; draft: ServerDraft | null }) => void
  onExpired?: () => void
  onClosed?: () => void
  onState?: (s: SaveState) => void
  debounceMs?: number
  maxIntervalMs?: number
  retryMs?: number
  now?: () => number
}

export interface DraftAutosaver {
  notifyChange(payload: DraftPayload): void
  /** Lưu ngay nếu còn thay đổi chưa lưu — CHỜ cả lần lưu đang bay. `true` = không còn gì chưa lưu. */
  flush(): Promise<boolean>
  isDirty(): boolean
  adoptVersion(version: number): void
  getBaseVersion(): number
  /** Ngừng hẳn (đã nộp): không lưu, không hẹn giờ nữa. */
  dispose(): void
}

/**
 * Bộ tự lưu: mỗi thay đổi hẹn lưu sau 2,5 giây im; gõ liên tục thì vẫn lưu ít nhất 10 giây một lần;
 * lỗi mạng thì giữ "chưa lưu" và thử lại sau 10 giây. Không bao giờ có hai lần lưu bay cùng lúc
 * (hai PATCH cùng `baseVersion` sẽ tự gây 409).
 */
export function createDraftAutosaver(opts: DraftAutosaverOptions): DraftAutosaver {
  const debounceMs = opts.debounceMs ?? DRAFT_DEBOUNCE_MS
  const maxIntervalMs = opts.maxIntervalMs ?? DRAFT_MAX_INTERVAL_MS
  const retryMs = opts.retryMs ?? DRAFT_RETRY_MS
  const now = opts.now ?? Date.now

  let latest: DraftPayload | null = null
  let baseVersion = 0
  let dirty = false
  let inFlight: Promise<void> | null = null
  let disposed = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastSaveAt = now()
  let failed = false

  const setState = (s: SaveState) => {
    if (!disposed) opts.onState?.(s)
  }
  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }
  const schedule = (delay: number) => {
    if (disposed) return
    clearTimer()
    timer = setTimeout(() => {
      timer = null
      void run()
    }, delay)
  }

  const saveOnce = async (): Promise<void> => {
    if (disposed || !dirty || latest === null) return
    const payload = latest
    const version = baseVersion
    dirty = false
    setState('saving')
    let result: DraftSaveResult
    try {
      result = await opts.save(payload, version)
    } catch {
      result = { kind: 'error' }
    }
    if (disposed) return
    switch (result.kind) {
      case 'saved':
        failed = false
        baseVersion = result.version
        lastSaveAt = now()
        opts.onSaved?.({ version: result.version, clock: result.clock })
        setState(dirty ? 'pending' : 'saved')
        break
      case 'conflict':
        // Không tự lưu lại cùng bản cũ (sẽ lệch tiếp): người gọi gộp, nhận version mới rồi báo thay đổi.
        failed = false
        opts.onConflict?.({ serverVersion: result.serverVersion, draft: result.draft })
        break
      case 'expired':
        opts.onExpired?.()
        dispose()
        return
      case 'closed':
        opts.onClosed?.()
        dispose()
        return
      case 'error':
        failed = true
        dirty = true
        setState('retrying')
        schedule(retryMs)
        return
    }
    // Thay đổi tới trong lúc đang lưu thì còn một lần lưu nữa.
    if (dirty) schedule(debounceMs)
  }

  const run = (): Promise<void> => {
    if (inFlight) return inFlight
    const p = saveOnce().finally(() => {
      inFlight = null
    })
    inFlight = p
    return p
  }

  function dispose() {
    disposed = true
    clearTimer()
  }

  return {
    notifyChange(payload) {
      if (disposed) return
      latest = payload
      dirty = true
      if (!failed) setState('pending')
      const capDelay = Math.max(0, maxIntervalMs - (now() - lastSaveAt))
      // Đang chờ thử lại sau lỗi thì không dồn thêm lần gọi: giữ nhịp thử lại.
      if (failed && timer !== null) return
      schedule(Math.min(debounceMs, capDelay))
    },
    async flush() {
      if (disposed) return !dirty
      clearTimer()
      if (inFlight) await inFlight
      if (dirty) await run()
      return !dirty && !failed
    },
    isDirty: () => dirty || inFlight !== null,
    adoptVersion(version) {
      baseVersion = version
    },
    getBaseVersion: () => baseVersion,
    dispose,
  }
}

// ─── chặng thi telc ──────────────────────────────────────────────────────────
// Thứ tự buổi thi thật: Lesen + Sprachbausteine → Hören → Schreiben. Sang chặng sau thì không quay lại
// chặng trước (Hören không nghe lại được). Cùng luật với web (`components/exam/mock/mockModel.ts`).

const STAGE_OF: Record<string, number> = { LESEN: 0, SPRACHBAUSTEINE: 0, HOEREN: 1, SCHREIBEN: 2 }
const STAGE_NAME = ['Lesen + Sprachbausteine', 'Hören', 'Schreiben']
const STAGE_SHORT = ['Lesen + SB', 'Hören', 'Schreiben']

export function stageOf(section: string): number {
  return STAGE_OF[section] ?? 0
}

export const stageName = (stage: number): string => STAGE_NAME[stage] ?? STAGE_NAME[0]
export const stageShort = (stage: number): string => STAGE_SHORT[stage] ?? STAGE_SHORT[0]

/** Các chặng có trong đề (theo các phần app dựng được), tăng dần. */
export function stagesIn(sectionNames: readonly string[]): number[] {
  return Array.from(new Set(sectionNames.map(stageOf))).sort((a, b) => a - b)
}

/** Chặng kế tiếp có trong đề; `null` khi đang ở chặng cuối. */
export function nextStage(stages: readonly number[], stage: number): number | null {
  return stages.find((s) => s > stage) ?? null
}

/** Tên các phần theo đúng thứ tự trong `sections_json` — chỉ số này là `sectionIndex` server lưu cùng nháp. */
export function rawSectionNames(sectionsJson: string | null | undefined): string[] {
  if (!sectionsJson) return []
  try {
    const root = JSON.parse(sectionsJson) as { sections?: { name?: unknown }[] }
    return Array.isArray(root.sections) ? root.sections.map((s) => String(s?.name ?? '')) : []
  } catch {
    return []
  }
}

/**
 * Chặng khi mở lại lượt đang dở: chặng của phần server nhớ (`section_index`, có thể do web ghi). Chặng
 * đó app không có thì lấy chặng có mặt gần nhất về sau — không bao giờ lùi về chặng đã khoá.
 */
export function resumeStage(rawNames: readonly string[], serverSectionIndex: number | null | undefined, stages: readonly number[]): number {
  if (stages.length === 0) return 0
  const name = serverSectionIndex != null ? rawNames[serverSectionIndex] : undefined
  if (!name) return stages[0]
  const wanted = stageOf(name)
  return stages.find((s) => s >= wanted) ?? stages[stages.length - 1]
}

/**
 * `sectionIndex` gửi cùng nháp khi đang ở `stage`: giữ chỉ số server đang nhớ nếu nó cùng chặng (web có
 * thể đã ghi đúng Teil đang làm), không thì phần đầu tiên của chặng — để web mở lại đúng chặng.
 */
export function sectionIndexForStage(rawNames: readonly string[], stage: number, current: number | null | undefined): number {
  if (current != null && rawNames[current] != null && stageOf(rawNames[current]) === stage && rawNames[current] in STAGE_OF) return current
  const i = rawNames.findIndex((n) => n in STAGE_OF && stageOf(n) === stage)
  return i >= 0 ? i : (current ?? 0)
}

const SECTION_SHORT: Record<string, string> = { LESEN: 'L', SPRACHBAUSTEINE: 'SB', HOEREN: 'H', SCHREIBEN: 'S' }

/** Nhãn ngắn của một Teil trên dải chip: `L3 · 7/10`; bài viết: `Schreiben · đã viết`. */
export function teilChipLabel(section: string, teilNo: number | undefined, done: number, total: number): string {
  if (section === 'SCHREIBEN') return done > 0 ? 'Schreiben · đã viết' : 'Schreiben · chưa viết'
  return `${SECTION_SHORT[section] ?? section}${teilNo ?? ''} · ${done}/${total}`
}

/** Câu chưa làm (bài viết tính một câu) — cho hộp xác nhận nộp bài. */
export function unansweredCount(keys: readonly string[], answers: Record<string, string>): number {
  return keys.filter((k) => (answers[k] ?? '').trim().length === 0).length
}
