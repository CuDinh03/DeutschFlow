// Đánh dấu bài đọc trên app (giao diện v3.4, Đợt 4c, 19/11/2026) — hàm thuần. Gói lưu cùng chỗ với web
// (`/mock-exams/practice/{examId}/teile/{key}/marks`, bảng `exam_passage_marks`), cùng định dạng với
// `frontend/src/components/exam/marks/marksModel.ts`: tô trên web thấy trên app và ngược lại.
//
// Khác web: điện thoại không bôi đen chữ được thoải mái, nên app tô theo CÂU — chọn bút rồi chạm vào một
// câu (như mẫu iOS `attempt`). Đánh dấu do web tạo (một cụm bất kỳ, gắn số câu, ghi chú) vẫn hiện đủ màu và
// gạch chân; app giữ nguyên `q`, `n`, `struck` khi lưu lại.
//
// Vị trí là ký tự `[s, e)` trên chữ của một KHỐI; app chỉ dùng khối `ctx` = bài đọc (`teil.context`,
// `\r\n` → `\n`), y như `PassageMarksValidator.blocksOf` phía server.

export type MarkKind = 'hl' | 'ul'
export type MarkColor = 'y' | 'g' | 'p'
/** Bút trên thanh công cụ: ba màu tô, gạch chân, tẩy. */
export type Pen = MarkColor | 'ul' | 'erase'

export const MARK_COLORS: readonly MarkColor[] = ['y', 'g', 'p']
export const CONTEXT_BLOCK = 'ctx'

export interface Mark {
  id: string
  /** Nhóm: các mảnh của cùng một lần tô. */
  g: string
  /** Khối chữ. */
  b: string
  s: number
  e: number
  k: MarkKind
  /** Màu (chỉ `hl`). */
  c: MarkColor | null
  /** Id câu được gắn (web). */
  q: string | null
  /** Ghi chú (web). */
  n: string
}

export interface MarksPack {
  v: 1
  /** Hash chữ của các khối có đánh dấu — lệch ⇒ đề đã bị sửa chữ. */
  blocks: Record<string, string>
  marks: Mark[]
  /** Phương án đã gạch bỏ theo câu (web) — app giữ nguyên. */
  struck: Record<string, string[]>
}

export interface Piece {
  b: string
  s: number
  e: number
}

/** Giới hạn của server (`PassageMarksValidator.MAX_MARKS`). */
export const MAX_MARKS = 300

export function emptyPack(): MarksPack {
  return { v: 1, blocks: {}, marks: [], struck: {} }
}

export function normalizeBlock(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

let counter = 0
export function uid(prefix: string): string {
  counter = (counter + 1) % 1e6
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** FNV-1a 32 bit trên đơn vị UTF-16 — y hệt `PassageMarksValidator.hash` phía server và bản web. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/** Đọc gói từ server: thiếu trường thì lấp mặc định, mảnh hỏng thì bỏ (như web). */
export function parsePack(raw: unknown): MarksPack {
  const p = emptyPack()
  if (!raw || typeof raw !== 'object') return p
  const r = raw as Partial<MarksPack>
  if (r.blocks && typeof r.blocks === 'object') p.blocks = { ...r.blocks }
  if (r.struck && typeof r.struck === 'object') {
    for (const [id, list] of Object.entries(r.struck)) if (Array.isArray(list) && list.length) p.struck[id] = list.map(String)
  }
  if (Array.isArray(r.marks)) {
    for (const m of r.marks) {
      if (!m || typeof m !== 'object') continue
      const { id, g, b, s, e, k } = m as Mark
      if (typeof id !== 'string' || typeof g !== 'string' || typeof b !== 'string') continue
      if (typeof s !== 'number' || typeof e !== 'number' || e <= s) continue
      if (k !== 'hl' && k !== 'ul') continue
      const c = k === 'hl' && MARK_COLORS.includes((m as Mark).c as MarkColor) ? ((m as Mark).c as MarkColor) : null
      if (k === 'hl' && !c) continue
      p.marks.push({ id, g, b, s, e, k, c, q: (m as Mark).q ?? null, n: (m as Mark).n ?? '' })
    }
  }
  return p
}

/**
 * Bỏ đánh dấu của khối APP ĐANG DỰNG (`texts`) đã đổi chữ (hash lệch) và mảnh vượt độ dài khối (như web).
 * Mảnh thuộc khối app KHÔNG dựng (vd. đề câu `q:<id>` web cho tô) được giữ NGUYÊN và gửi lại khi lưu —
 * server ghi đè cả gói, bỏ chúng là xoá mất đánh dấu + ghi chú của web (soát Đợt 4c, HIGH).
 */
export function dropStale(pack: MarksPack, texts: Record<string, string>): { pack: MarksPack; dropped: boolean } {
  const ok = (m: Mark) => {
    const t = texts[m.b]
    if (t == null) return true
    return (pack.blocks[m.b] == null || pack.blocks[m.b] === fnv1a(t)) && m.e <= t.length
  }
  const marks = pack.marks.filter(ok)
  if (marks.length === pack.marks.length) return { pack, dropped: false }
  return { pack: { ...pack, marks }, dropped: true }
}

/** Ghi hash cho khối có đánh dấu: khối app dựng dùng hash chữ hiện tại; khối khác giữ hash đã có. */
function stamp(pack: MarksPack, texts: Record<string, string>): MarksPack {
  const blocks: Record<string, string> = {}
  for (const m of pack.marks) {
    if (texts[m.b] != null) blocks[m.b] = fnv1a(texts[m.b])
    else if (pack.blocks[m.b] != null) blocks[m.b] = pack.blocks[m.b]
  }
  return { ...pack, blocks }
}

/** Mảnh có dữ liệu web (gắn câu `q` hoặc ghi chú `n`) — app không hiện được nên không được làm mất. */
function hasWebData(m: Mark): boolean {
  return m.q != null || (m.n ?? '') !== ''
}

export function coveredFully(marks: readonly Mark[], piece: Piece, filter: (m: Mark) => boolean): boolean {
  const rs = marks.filter((m) => m.b === piece.b && filter(m) && m.e > piece.s && m.s < piece.e).sort((a, b) => a.s - b.s)
  let cur = piece.s
  for (const r of rs) {
    if (r.s > cur) return false
    cur = Math.max(cur, r.e)
    if (cur >= piece.e) return true
  }
  return cur >= piece.e
}

/** Cắt `[s, e)` khỏi các mảnh thoả `filter` trong khối — tách đôi nếu cần. */
export function subtract(marks: readonly Mark[], piece: Piece, filter: (m: Mark) => boolean): Mark[] {
  const out: Mark[] = []
  for (const m of marks) {
    if (m.b !== piece.b || !filter(m) || m.e <= piece.s || m.s >= piece.e) {
      out.push(m)
      continue
    }
    if (m.s < piece.s) out.push({ ...m, e: piece.s })
    if (m.e > piece.e) out.push({ ...m, id: uid('h'), s: piece.e })
  }
  return out
}

/**
 * Áp một bút lên một câu (mảnh `piece`), trả gói mới:
 * - bút màu: câu đã tô trọn bằng đúng màu đó ⇒ bỏ tô (chạm lại để xoá); không thì tô, màu mới đè màu cũ;
 * - gạch chân: bật/tắt;
 * - tẩy: bỏ mọi lớp trong câu.
 */
export function applyPen(pack: MarksPack, texts: Record<string, string>, piece: Piece, pen: Pen): MarksPack {
  if (piece.e <= piece.s) return pack
  let marks = [...pack.marks]
  const inPiece = (m: Mark) => m.b === piece.b && m.e > piece.s && m.s < piece.e
  if (pen === 'erase') {
    // Tẩy không xoá mảnh mang gắn câu / ghi chú của web (app không hiện được, xoá là mất âm thầm).
    marks = subtract(marks, piece, (m) => !hasWebData(m))
  } else if (pen === 'ul') {
    const full = coveredFully(marks, piece, (m) => m.k === 'ul')
    const carry = marks.find((m) => inPiece(m) && m.k === 'ul' && hasWebData(m))
    marks = subtract(marks, piece, (m) => m.k === 'ul')
    if (!full || carry) marks.push(newMark(piece, 'ul', null, carry))
  } else {
    const same = coveredFully(marks, piece, (m) => m.k === 'hl' && m.c === pen)
    // Tô đè: mang theo gắn câu + ghi chú của mảnh web trong câu này sang mảnh mới.
    const carry = marks.find((m) => inPiece(m) && m.k === 'hl' && hasWebData(m))
    marks = subtract(marks, piece, (m) => m.k === 'hl')
    if (!same || carry) marks.push(newMark(piece, 'hl', pen, carry))
  }
  return stamp({ ...pack, marks }, texts)
}

function newMark(piece: Piece, k: MarkKind, c: MarkColor | null, carry?: Mark): Mark {
  return { id: uid('h'), g: uid('g'), b: piece.b, s: piece.s, e: piece.e, k, c, q: carry?.q ?? null, n: carry?.n ?? '' }
}

export function isFull(pack: MarksPack): boolean {
  return pack.marks.length >= MAX_MARKS
}

// ─── câu và đoạn hiển thị ──────────────────────────────────────────────────

/** Một dòng của bài đọc (theo dòng tác giả ngắt) với vị trí trong khối. */
export interface PassageLine {
  start: number
  end: number
  text: string
}

export function splitLines(text: string): PassageLine[] {
  const out: PassageLine[] = []
  let start = 0
  for (const line of text.split('\n')) {
    out.push({ start, end: start + line.length, text: line })
    start += line.length + 1
  }
  return out
}

const SENTENCE_END = /[.!?…]/
const CLOSERS = /["'“”„«»)\]]/

/**
 * Câu của cả khối: kết thúc ở `.`, `!`, `?`, `…` (kèm dấu ngoặc/nháy đóng ngay sau) khi tiếp theo là
 * khoảng trắng hoặc hết chữ; dòng trống (hết đoạn) cũng là hết câu. `splitOnNewline`: mỗi xuống dòng là
 * hết đoạn (bài không đánh số dòng); bài đánh số dòng thì câu vắt qua dòng tác giả ngắt. Bỏ khoảng trắng
 * hai đầu. Viết tắt kiểu „z. B.“ có thể bị cắt đôi — chạm hai lần là tô đủ, chấp nhận được.
 */
export function sentenceRanges(text: string, splitOnNewline = true): [number, number][] {
  const out: [number, number][] = []
  let s = 0
  const push = (a: number, b: number) => {
    while (a < b && /\s/.test(text[a])) a++
    while (b > a && /\s/.test(text[b - 1])) b--
    if (b > a) out.push([a, b])
  }
  const paragraphBreak = (i: number) => {
    if (splitOnNewline) return true
    let j = i + 1
    while (j < text.length && text[j] !== '\n' && /\s/.test(text[j])) j++
    return j >= text.length || text[j] === '\n'
  }
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      if (paragraphBreak(i)) {
        push(s, i)
        s = i + 1
      }
      continue
    }
    if (!SENTENCE_END.test(text[i])) continue
    let j = i + 1
    while (j < text.length && (SENTENCE_END.test(text[j]) || CLOSERS.test(text[j]))) j++
    if (j === text.length || /\s/.test(text[j])) {
      push(s, j)
      s = j
      i = j - 1
    }
  }
  push(s, text.length)
  return out
}

/** Một đoạn chữ hiển thị: cùng kiểu tô suốt đoạn. `sentence` = câu chứa đoạn (null = khoảng trắng giữa câu). */
export interface Segment {
  start: number
  end: number
  text: string
  color: MarkColor | null
  underline: boolean
  sentence: [number, number] | null
}

/**
 * Cắt một dòng thành đoạn theo ranh giới câu (`sentences` của cả khối) và ranh giới đánh dấu; màu lấy lớp
 * trên cùng (cuối mảng), như web.
 */
export function lineSegments(
  text: string,
  line: PassageLine,
  sentences: readonly [number, number][],
  marks: readonly Mark[],
  block = CONTEXT_BLOCK,
): Segment[] {
  if (line.end <= line.start) return []
  const clip = (x: number) => Math.min(line.end, Math.max(line.start, x))
  const inBlock = marks.filter((m) => m.b === block && m.e > line.start && m.s < line.end)
  const cuts = new Set<number>([line.start, line.end])
  for (const [a, b] of sentences) {
    if (b <= line.start || a >= line.end) continue
    cuts.add(clip(a))
    cuts.add(clip(b))
  }
  for (const m of inBlock) {
    cuts.add(clip(m.s))
    cuts.add(clip(m.e))
  }
  const points = Array.from(cuts).sort((a, b) => a - b)
  const out: Segment[] = []
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (b <= a) continue
    let color: MarkColor | null = null
    let underline = false
    for (const m of inBlock) {
      if (m.s > a || m.e < b) continue
      if (m.k === 'hl') color = m.c
      else underline = true
    }
    const sentence = sentences.find(([x, y]) => x <= a && b <= y) ?? null
    out.push({ start: a, end: b, text: text.slice(a, b), color, underline, sentence })
  }
  return out
}

/** Bài đọc của Teil để đánh dấu: `teil.context` thô trong `sectionsJson` (khối `ctx` phía server). */
export function teilContext(sectionsJson: string | null | undefined, teilKey: string): string | null {
  const m = /^([A-Z]+)-(\d+)$/.exec(teilKey)
  if (!sectionsJson || !m) return null
  try {
    const root = JSON.parse(sectionsJson) as { sections?: { name?: unknown; teile?: unknown }[] }
    const section = (root.sections ?? []).find((s) => s?.name === m[1])
    const teile = Array.isArray(section?.teile) ? (section.teile as Record<string, unknown>[]) : []
    const n = Number(m[2])
    const teil = teile.find((t) => t?.teil === n) ?? (teile.every((t) => t?.teil == null) ? teile[n - 1] : undefined)
    const ctx = teil?.context
    return typeof ctx === 'string' && ctx.trim() ? normalizeBlock(ctx) : null
  } catch {
    return null
  }
}
