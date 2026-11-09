/**
 * Mô hình đánh dấu bài đọc (09/11/2026) — hàm thuần, chuyển từ bản mẫu `prototypes/lesen-danh-dau.html`
 * đã duyệt. Gói lưu ở `exam_passage_marks.marks_json`, kiểm phía server bởi `PassageMarksValidator`.
 *
 * Vị trí là ký tự `[s, e)` trên chữ của một KHỐI: `ctx` = bài đọc (`teil.context`, `\r\n` → `\n`),
 * `q:<idCâu>` = đề câu. Một lần tô kéo qua nhiều khối? Không: đợt 1 mỗi lần tô nằm trong một khối
 * (bài đọc là một khối liền dù nhiều đoạn), nên "nhóm" (`g`) thường một mảnh; tô đè / tẩy tách nhóm
 * thành nhiều mảnh cùng `g`.
 *
 * Thứ tự trong mảng = thứ tự xếp lớp: phần tử sau nằm trên (màu mới đè màu cũ).
 */

export type MarkKind = 'hl' | 'ul'
export type MarkColor = 'y' | 'g' | 'p'

export const MARK_COLORS: readonly MarkColor[] = ['y', 'g', 'p']

export interface Mark {
  id: string
  /** Nhóm: các mảnh của cùng một lần tô. Gắn câu / ghi chú áp cho cả nhóm. */
  g: string
  /** Khối chữ. */
  b: string
  s: number
  e: number
  k: MarkKind
  /** Màu (chỉ `hl`). */
  c: MarkColor | null
  /** Id câu được gắn (không phải số hiển thị). */
  q: string | null
  /** Ghi chú. */
  n: string
}

export interface MarksPack {
  v: 1
  /** Hash chữ của các khối có đánh dấu, do server ghi — lệch ⇒ đề bị sửa chữ. */
  blocks: Record<string, string>
  marks: Mark[]
  /** Phương án đã gạch bỏ theo câu. */
  struck: Record<string, string[]>
}

export interface Piece {
  b: string
  s: number
  e: number
}

export const MAX_MARKS = 300
export const MAX_NOTE = 500

export function emptyPack(): MarksPack {
  return { v: 1, blocks: {}, marks: [], struck: {} }
}

let counter = 0
export function uid(prefix: string): string {
  counter = (counter + 1) % 1e6
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** FNV-1a 32 bit trên đơn vị UTF-16 — y hệt `PassageMarksValidator.hash` phía server. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/** Đọc gói từ server: thiếu trường thì lấp mặc định, mảnh hỏng thì bỏ. */
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
 * Bỏ đánh dấu của khối đã đổi chữ (hash lệch) hoặc không còn, và mảnh vượt độ dài khối. Owner chốt
 * 09/11/2026: bỏ + báo một dòng, không cố gắn lại.
 */
export function dropStale(pack: MarksPack, texts: Record<string, string>): { pack: MarksPack; dropped: boolean } {
  const ok = (b: string) => texts[b] != null && (pack.blocks[b] == null || pack.blocks[b] === fnv1a(texts[b]))
  const marks = pack.marks.filter((m) => ok(m.b) && m.e <= texts[m.b].length)
  if (marks.length === pack.marks.length) return { pack, dropped: false }
  return { pack: { ...pack, marks }, dropped: true }
}

/** Ghi hash hiện tại cho khối vừa có đánh dấu (server cũng ghi lại; giữ để so ngay trên máy). */
function stamp(pack: MarksPack, texts: Record<string, string>): MarksPack {
  const blocks: Record<string, string> = {}
  for (const m of pack.marks) if (texts[m.b] != null) blocks[m.b] = pack.blocks[m.b] ?? fnv1a(texts[m.b])
  return { ...pack, blocks }
}

/** Bộ chọn CSS các đoạn chữ thuộc một nhóm (thoát dấu nháy — id đến từ server). */
export function groupSelector(gid: string): string {
  return `[data-seg][data-gids~="${gid.replace(/["\\]/g, '\\$&')}"]`
}

// ─── vùng chọn ──────────────────────────────────────────────────────────────

// Chữ cái (mọi bảng chữ có hoa/thường: ä, ß, đ…) hoặc chữ số. Không dùng /\p{L}/u: dự án biên dịch ES5.
const isWord = (ch: string | undefined) => !!ch && (ch.toLowerCase() !== ch.toUpperCase() || /[0-9]/.test(ch))

/** Mở rộng cho trọn từ (chọn giữa từ ⇒ cả từ) và bỏ khoảng trắng hai đầu. `null` nếu rỗng. */
export function snapToWords(text: string, s: number, e: number): [number, number] | null {
  let a = Math.max(0, Math.min(s, text.length))
  let b = Math.max(0, Math.min(e, text.length))
  if (b < a) [a, b] = [b, a]
  if (a === b) return null // con trỏ chứ không phải vùng chọn: không tự chọn cả từ
  while (a > 0 && isWord(text[a - 1]) && isWord(text[a])) a--
  while (b < text.length && isWord(text[b]) && isWord(text[b - 1])) b++
  while (a < b && /\s/.test(text[a])) a++
  while (b > a && /\s/.test(text[b - 1])) b--
  return b > a ? [a, b] : null
}

// ─── truy vấn ───────────────────────────────────────────────────────────────

export function groupPieces(pack: MarksPack, gid: string): Mark[] {
  return pack.marks.filter((m) => m.g === gid)
}

export function coveredFully(marks: readonly Mark[], piece: Piece, kind: MarkKind): boolean {
  const rs = marks.filter((m) => m.b === piece.b && m.k === kind && m.e > piece.s && m.s < piece.e).sort((a, b) => a.s - b.s)
  let cur = piece.s
  for (const r of rs) {
    if (r.s > cur) return false
    cur = Math.max(cur, r.e)
    if (cur >= piece.e) return true
  }
  return cur >= piece.e
}

export function overlapsAny(pack: MarksPack, pieces: readonly Piece[]): boolean {
  return pieces.some((p) => pack.marks.some((m) => m.b === p.b && m.s < p.e && m.e > p.s))
}

/** Màu đang phủ đầu vùng chọn (để gắn câu giữ màu cũ), không có ⇒ `null`. */
export function colorAt(pack: MarksPack, piece: Piece): MarkColor | null {
  for (let i = pack.marks.length - 1; i >= 0; i--) {
    const m = pack.marks[i]
    if (m.b === piece.b && m.k === 'hl' && m.s <= piece.s && m.e > piece.s) return m.c
  }
  return null
}

/** Mảnh cuối của mỗi nhóm (theo thứ tự khối, rồi vị trí) — nơi đặt nhãn số câu / ghi chú. */
export function lastPieces(pack: MarksPack, blockOrder: (b: string) => number): Map<string, Mark> {
  const out = new Map<string, Mark>()
  for (const m of pack.marks) {
    const c = out.get(m.g)
    if (!c || blockOrder(m.b) > blockOrder(c.b) || (m.b === c.b && m.e > c.e)) out.set(m.g, m)
  }
  return out
}

/** Các nhóm gắn vào câu, theo thứ tự xuất hiện trong bài. */
export function groupsForItem(pack: MarksPack, itemId: string, blockOrder: (b: string) => number): string[] {
  const first = new Map<string, Mark>()
  for (const m of pack.marks) {
    if (m.q !== itemId) continue
    const c = first.get(m.g)
    if (!c || blockOrder(m.b) < blockOrder(c.b) || (m.b === c.b && m.s < c.s)) first.set(m.g, m)
  }
  return Array.from(first.values()).sort((a, b) => blockOrder(a.b) - blockOrder(b.b) || a.s - b.s).map((m) => m.g)
}

export function hasContent(pack: MarksPack): boolean {
  return pack.marks.length > 0 || Object.keys(pack.struck).length > 0
}

// ─── thao tác (trả gói mới) ─────────────────────────────────────────────────

/** Cắt `[s, e)` khỏi các mảnh thoả `filter` trong khối — tách đôi nếu cần. Nền của tô đè và tẩy. */
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

function push(marks: Mark[], pieces: readonly Piece[], k: MarkKind, c: MarkColor | null, q: string | null, n: string, gid = uid('g')) {
  for (const p of pieces) marks.push({ id: uid('h'), g: gid, b: p.b, s: p.s, e: p.e, k, c: k === 'hl' ? c : null, q, n })
  return gid
}

/**
 * Tô màu (`hl`) hoặc gạch chân (`ul`) vùng chọn. Màu mới đè màu cũ trong vùng; gạch chân bật/tắt
 * (cả vùng đã gạch ⇒ bỏ gạch, `gid` = null).
 */
export function addMark(
  pack: MarksPack,
  texts: Record<string, string>,
  pieces: readonly Piece[],
  k: MarkKind,
  c: MarkColor | null,
  q: string | null = null,
): { pack: MarksPack; gid: string | null } {
  let marks = [...pack.marks]
  if (k === 'ul') {
    const full = pieces.every((p) => coveredFully(marks, p, 'ul'))
    for (const p of pieces) marks = subtract(marks, p, (m) => m.k === 'ul')
    if (full) return { pack: stamp({ ...pack, marks }, texts), gid: null }
  } else {
    for (const p of pieces) marks = subtract(marks, p, (m) => m.k === 'hl')
  }
  const gid = push(marks, pieces, k, c, q, '')
  return { pack: stamp({ ...pack, marks }, texts), gid }
}

/** Đổi màu nhóm (đưa lên trên cùng). Nhóm chỉ gạch chân ⇒ thêm lớp màu, chuyển số câu + ghi chú sang lớp màu. */
export function recolor(pack: MarksPack, texts: Record<string, string>, gid: string, c: MarkColor): { pack: MarksPack; gid: string } {
  const ps = groupPieces(pack, gid)
  if (ps.length === 0) return { pack, gid }
  if (ps[0].k === 'ul') {
    let marks = pack.marks.map((m) => (m.g === gid ? { ...m, q: null, n: '' } : m))
    for (const p of ps) marks = subtract(marks, p, (m) => m.k === 'hl')
    const g2 = push(marks, ps, 'hl', c, ps[0].q, ps[0].n)
    return { pack: stamp({ ...pack, marks }, texts), gid: g2 }
  }
  const rest = pack.marks.filter((m) => m.g !== gid)
  return { pack: { ...pack, marks: [...rest, ...ps.map((m) => ({ ...m, c }))] }, gid }
}

/** Bật/tắt gạch chân trên phạm vi của nhóm. Nhóm chỉ gạch chân ⇒ xoá nhóm. */
export function toggleUnderline(pack: MarksPack, texts: Record<string, string>, gid: string): MarksPack {
  const ps = groupPieces(pack, gid)
  if (ps.length === 0) return pack
  if (ps[0].k === 'ul') return removeGroup(pack, gid)
  let marks = [...pack.marks]
  const full = ps.every((p) => coveredFully(marks, p, 'ul'))
  for (const p of ps) marks = subtract(marks, p, (m) => m.k === 'ul')
  if (!full) push(marks, ps, 'ul', null, null, '')
  return stamp({ ...pack, marks }, texts)
}

export function setTag(pack: MarksPack, gid: string, q: string | null): MarksPack {
  return { ...pack, marks: pack.marks.map((m) => (m.g === gid ? { ...m, q } : m)) }
}

export function setNote(pack: MarksPack, gid: string, note: string): MarksPack {
  const n = note.trim().slice(0, MAX_NOTE)
  return { ...pack, marks: pack.marks.map((m) => (m.g === gid ? { ...m, n } : m)) }
}

export function removeGroup(pack: MarksPack, gid: string): MarksPack {
  return { ...pack, marks: pack.marks.filter((m) => m.g !== gid) }
}

/** Tẩy mọi lớp trong vùng chọn. */
export function erase(pack: MarksPack, pieces: readonly Piece[]): MarksPack {
  let marks = [...pack.marks]
  for (const p of pieces) marks = subtract(marks, p, () => true)
  return { ...pack, marks }
}

export function isStruck(pack: MarksPack, itemId: string, opt: string): boolean {
  return pack.struck[itemId]?.includes(opt) ?? false
}

export function setStruck(pack: MarksPack, itemId: string, opt: string, on: boolean): MarksPack {
  const cur = new Set(pack.struck[itemId] ?? [])
  if (on) cur.add(opt)
  else cur.delete(opt)
  const struck = { ...pack.struck }
  if (cur.size) struck[itemId] = Array.from(cur)
  else delete struck[itemId]
  return { ...pack, struck }
}

// ─── chẩn đoán sau khi kiểm tra ─────────────────────────────────────────────

export type DiagnosisKind = 'found' | 'offTarget' | 'untagged' | 'none'

export interface Diagnosis {
  kind: DiagnosisKind
  /** Dòng của các đoạn đã gắn vào câu (khi lệch chỗ). */
  tagged: Piece[]
}

/**
 * Học viên đã tìm đúng đoạn chứa đáp án chưa:
 * `found` = có đoạn GẮN vào câu chạm vị trí đáp án · `offTarget` = có gắn nhưng không chạm ·
 * `untagged` = có tô chạm vị trí đáp án nhưng chưa gắn · `none` = chưa đánh dấu gì ở đó.
 * Chỉ xét khối bài đọc (`ctx`).
 */
export function diagnose(pack: MarksPack, itemId: string, evidence: readonly Piece[]): Diagnosis {
  const touches = (m: Mark) => evidence.some((ev) => ev.b === m.b && m.s < ev.e && m.e > ev.s)
  const tagged = pack.marks.filter((m) => m.q === itemId && m.b === 'ctx')
  if (tagged.some(touches)) return { kind: 'found', tagged }
  if (tagged.length) return { kind: 'offTarget', tagged }
  if (pack.marks.some(touches)) return { kind: 'untagged', tagged }
  return { kind: 'none', tagged }
}
