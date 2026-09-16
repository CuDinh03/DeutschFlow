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
 * Cả hai đều TUỲ CHỌN: `audio_script` là chuỗi và không khai `max_plays` thì mọi đề Goethe hiện có
 * chạy y như trước.
 */

/** Một lượt nói. `speaker` chọn giọng; `name` là tên hiện trên màn hình. */
export interface AudioTurn {
  speaker?: string
  name?: string
  text: string
}

/** Vai mặc định khi kịch bản không nói rõ — luân phiên để hai người luôn khác giọng. */
const ALTERNATING_ROLES = ['PRUEFER', 'PARTNER'] as const

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
