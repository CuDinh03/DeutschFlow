/**
 * Kịch bản phần Nghe và ngân sách lượt phát.
 *
 * Hai thứ đề telc cần mà đề Goethe không:
 *
 * 1. **Số lần nghe khác nhau theo Teil** — Hörverstehen Teil 1 chỉ được nghe MỘT lần, Teil 2 và 3
 *    được hai lần. Không giới hạn thì bài luyện không đo đúng cái đề thật đo.
 * 2. **Hội thoại hai người** — Teil 2 là 10 câu / 25 điểm trên một hội thoại dài. Một giọng đọc
 *    liền mạch thì học viên không biết ai đang nói, tức là đoán mò đúng phần nặng điểm nhất.
 *
 * Thêm 17/09/2026 — **nghi thức của bài nghe telc** (đo trên CD đề mẫu và Übungstest chính thức):
 *
 * 3. **Câu dẫn (Ansage) và thời gian đọc câu hỏi** — băng đề thật đọc hướng dẫn, rồi cho 30 giây
 *    (Teil 1) hoặc một phút (Teil 2) đọc câu hỏi, rồi mới phát bài. Học viên luyện mà đọc câu hỏi
 *    thoải mái trước rồi mới bấm nghe là đang luyện một bài dễ hơn bài sẽ thi.
 * 4. **Câu dẫn tình huống trước từng bài Teil 3** („Im Radio hören Sie folgenden Hinweis.") và
 *    **câu khung của Teil 1** (một câu hỏi chung, rồi năm người trả lời) — thiếu hai thứ này thì bài
 *    nghe sai thể loại: Teil 1 thành năm thông báo rời rạc, Teil 3 không biết mình đang nghe gì.
 *
 * Tất cả TUỲ CHỌN: `audio_script` là chuỗi và không khai `max_plays`/`ansage_de` thì mọi đề Goethe
 * hiện có chạy y như trước.
 */

/** Một lượt nói. `speaker` chọn giọng; `name` là tên hiện trên màn hình. */
export interface AudioTurn {
  speaker?: string
  name?: string
  text: string
  /** `LEAD_IN` = câu dẫn tình huống đọc bằng giọng người dẫn — hiện nhãn riêng, không phải nhân vật. */
  kind?: 'LEAD_IN'
}

/** Vai mặc định khi kịch bản không nói rõ — luân phiên để hai người luôn khác giọng. */
const ALTERNATING_ROLES = ['PRUEFER', 'PARTNER'] as const

/** Giọng đọc câu dẫn, câu khung và Ansage: luôn là người dẫn (giọng giám khảo). */
export const NARRATOR_ROLE = 'PRUEFER'

export type AudioScript = string | AudioTurn[]

export function isDialogueScript(script: AudioScript | undefined): script is AudioTurn[] {
  return Array.isArray(script) && script.length > 0
}

/**
 * Chuẩn hoá các lượt: điền vai còn thiếu bằng cách luân phiên, bỏ lượt rỗng.
 * Kịch bản khai `speaker` thì tôn trọng, vì một hội thoại có thể để một người nói hai lượt liền.
 */
export function normalizeTurns(turns: AudioTurn[]): Required<Pick<AudioTurn, 'speaker' | 'text'>>[] {
  const out: Required<Pick<AudioTurn, 'speaker' | 'text'>>[] = []
  let alternating = 0
  for (const turn of turns) {
    const text = (turn.text ?? '').trim()
    if (!text) continue
    const speaker = turn.speaker?.trim() || ALTERNATING_ROLES[alternating % ALTERNATING_ROLES.length]
    if (!turn.speaker) alternating += 1
    out.push({ speaker, text })
  }
  return out
}

/** Toàn văn kịch bản — dùng cho nhánh một giọng và cho phần xem lại sau khi nộp. */
export function scriptToPlainText(script: AudioScript): string {
  if (!isDialogueScript(script)) return String(script ?? '')
  return script
    .map((turn) => (turn.name ? `${turn.name}: ${turn.text}` : turn.text))
    .join('\n')
}

/**
 * Còn bao nhiêu lượt nghe. `max` không phải số dương ⇒ không giới hạn (`null`), đúng hành vi của
 * mọi đề Goethe đang có.
 */
export function playsLeft(max: number | undefined, used: number): number | null {
  if (typeof max !== 'number' || !Number.isFinite(max) || max <= 0) return null
  return Math.max(0, max - used)
}

export function canPlayAgain(max: number | undefined, used: number): boolean {
  const left = playsLeft(max, used)
  return left === null || left > 0
}

// ─── Nghi thức bài nghe telc (17/09/2026) ────────────────────────────────────────────────────────

/** Những khoá của một câu nghe mà nghi thức telc cần — tập con của item trong `sections_json`. */
export interface HoerenItemLike {
  audio_script?: AudioScript
  /** Câu dẫn tình huống đọc TRƯỚC bài (Teil 3): „Sie hören eine Nachricht auf dem Anrufbeantworter." */
  lead_in_de?: string
  /** Giọng của người nói bài này (Teil 1: năm người, nam nữ xen kẽ). */
  speaker?: string
  /** Tên người nói hiện trên màn hình (đề Goethe cũ dùng `person`). */
  person?: string
}

/**
 * Các lượt phát của MỘT câu nghe: câu dẫn (nếu có) rồi bài. Trả `null` khi câu không có bài nghe.
 *
 * Bài là chuỗi thì thành một lượt với giọng `speaker` của câu — đây là chỗ Teil 1 ra năm giọng
 * xen kẽ thay vì một giọng máy đọc cả năm người. Bài là mảng lượt thì giữ nguyên.
 */
export function itemTurns(item: HoerenItemLike): AudioTurn[] | null {
  const script = item.audio_script
  if (script === undefined || script === null || script === '') return null
  const body: AudioTurn[] = isDialogueScript(script)
    ? script
    : [{ speaker: item.speaker, name: item.person, text: String(script) }]
  const leadIn = item.lead_in_de?.trim()
  if (!leadIn) return body
  return [{ speaker: NARRATOR_ROLE, text: leadIn, kind: 'LEAD_IN' }, ...body]
}

/**
 * Câu này có cần giọng persona (server, hai giọng) thay vì giọng máy trình duyệt không?
 * Có khi đề khai vai người nói hoặc câu dẫn — tức là đề telc. Đề Goethe không khai ⇒ nhánh cũ.
 */
export function needsPersonaVoice(item: HoerenItemLike): boolean {
  return Boolean(item.lead_in_de?.trim() || item.speaker?.trim() || isDialogueScript(item.audio_script))
}

/** Cổng nghi thức của một Teil: Ansage → đọc câu hỏi → (câu khung) → nghe được. */
export interface HoerenGateSpec {
  /** Hướng dẫn đọc bằng giọng người dẫn, nguyên văn đề thật. */
  ansage: string
  /** Giây cho đọc câu hỏi trước khi phát (telc: 30 ở Teil 1, 60 ở Teil 2, 0 ở Teil 3). */
  readingSeconds: number
  /** Câu khung của Teil 1: câu hỏi chung mà năm người sắp trả lời. */
  framing?: string
}

/** Những khoá cấp Teil mà cổng nghi thức đọc. */
export interface HoerenTeilLike {
  ansage_de?: string
  reading_seconds?: number
  framing_de?: string
}

/** `null` = Teil không khai nghi thức (mọi đề Goethe) ⇒ không có cổng, phát ngay như trước. */
export function parseHoerenGate(teil: HoerenTeilLike): HoerenGateSpec | null {
  const ansage = teil.ansage_de?.trim()
  if (!ansage) return null
  const raw = teil.reading_seconds
  const readingSeconds =
    typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 0
  const framing = teil.framing_de?.trim()
  return { ansage, readingSeconds, framing: framing || undefined }
}

/**
 * Pha của cổng. `idle`: chưa bấm bắt đầu, câu hỏi còn ẩn (như chưa mở đề). `ansage`/`framing`:
 * đang đọc. `reading`: đếm ngược đọc câu hỏi, nút nghe khoá. `ready`: nghe được.
 */
export type HoerenGatePhase = 'idle' | 'ansage' | 'reading' | 'framing' | 'ready'

/** Bài nghe được phát khi cổng đã mở, hoặc khi Teil không có cổng. */
export function isHoerenUnlocked(phase: HoerenGatePhase | undefined): boolean {
  return phase === undefined || phase === 'ready'
}
