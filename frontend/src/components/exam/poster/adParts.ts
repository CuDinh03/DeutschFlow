/**
 * Tách chữ của một mẩu rao vặt (telc Lesen Teil 3) thành các phần của "áp phích": tiêu đề, dòng phụ, thân,
 * dòng liên hệ (14/11/2026). Phép thuần — KHÔNG đổi, thêm hay đảo chữ: các phần là những lát cắt `[s, e)` liền
 * nhau phủ kín chuỗi gốc, nên ghép lại đúng bằng chuỗi gốc và vị trí ký tự của bút đánh dấu (`ad:<k>`) giữ nguyên.
 *
 * Quy ước dòng (đề do Xưởng đề sinh từ đợt này, `SituationalTeile.ADS_SYSTEM`):
 *   dòng 1 = tiêu đề · dòng 2 ngắn (tuỳ chọn) = dòng phụ · các dòng giữa = thân · dòng cuối trông như
 *   liên hệ (Tel., e-mail, địa chỉ web, số điện thoại) = liên hệ.
 *
 * Mẩu cũ viết liền một đoạn (đề tay V325–V345) ⇒ chế độ `inline`: tiêu đề là phần trước dấu ngắt sớm nhất của
 * câu đầu (dấu hai chấm, dấu phẩy, gạch nối có cách, ngoặc mở, hoặc hết câu) nếu không quá
 * {@link MAX_HEADLINE} ký tự; mỗi câu còn lại là một phần thân; câu cuối có Tel./e-mail/web ⇒ liên hệ.
 * Không tìm ra tiêu đề hợp lý ⇒ chế độ `plain` (không tiêu đề, khuôn trơn).
 */

export type AdRole = 'headline' | 'tagline' | 'body' | 'contact'

export interface AdPart {
  role: AdRole
  /** Lát cắt `[s, e)` trên chuỗi gốc; `e` gồm cả khoảng trắng / xuống dòng đứng sau phần này. */
  s: number
  e: number
  /**
   * Chỉ tiêu đề ở chế độ `inline`: từ vị trí này đến `e` là dấu ngắt (", ", ". ", " – ") — vẫn nằm trong DOM
   * (đọc màn hình, sao chép, đánh dấu đều thấy) nhưng áp phích vẽ trong suốt để tiêu đề không treo dấu phẩy.
   */
  soft?: number
}

export interface AdParts {
  /** `lines`: theo quy ước dòng · `inline`: một đoạn, tách được tiêu đề · `plain`: không có tiêu đề. */
  mode: 'lines' | 'inline' | 'plain'
  parts: AdPart[]
}

/** Tiêu đề tách từ mẩu viết liền không dài quá chừng này ký tự (dài hơn thì chữ trang trí vỡ dòng xấu). */
export const MAX_HEADLINE = 52
/** Dòng 2 chỉ là dòng phụ khi ngắn. */
const MAX_TAGLINE = 40

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/
const URL = /(?:https?:\/\/|www\.)\S+|\b[\w-]+\.(?:de|at|ch|com|org|net|eu|info)\b/i
// không dùng lookbehind (Safari cũ): số bắt đầu bằng 0 phải đứng đầu chuỗi hoặc sau ký tự không phải số
const PHONE = /(?:\+\d{2}|(?:^|[^\d.,])0\d{2,5})[\s/-]\d{2,}/
const CONTACT_START = /^\s*(?:Tel(?:efon)?|Handy|Mobil|Fax|Kontakt|E-?Mail)\b/i
/** Từ mở đầu phần liên hệ nằm GIỮA câu cuối ("Festpreise, Tel. 0421-55 66 77"). */
const CONTACT_INLINE = /(?:^|[\s,;])(Tel(?:efon)?\b\.?|Handy\b|Mobil\b|Fax\b|Kontakt\b)/

/** Chuỗi trông như dòng liên hệ: có e-mail, địa chỉ web, số điện thoại, hoặc mở đầu bằng Tel./Handy/Kontakt… */
export function looksLikeContact(s: string): boolean {
  return EMAIL.test(s) || URL.test(s) || PHONE.test(s) || CONTACT_START.test(s)
}

/** Viết tắt có dấu chấm KHÔNG kết thúc câu. */
const ABBR = new Set([
  'tel', 'ca', 'max', 'min', 'z', 'b', 'bzw', 'inkl', 'exkl', 'nr', 'str', 'std', 'u', 'a', 'o', 'ä', 'd', 'h',
  'evtl', 'ggf', 'zzgl', 'mtl', 'tgl', 'dr', 'prof', 'fa', 'st', 'mo', 'di', 'mi', 'do', 'fr', 'sa', 'so', 'vgl',
])

const LETTER = /[A-Za-zÀ-ÖØ-öø-ÿ]/
const UPPER_OR_DIGIT = /[A-ZÀ-ÖØ-Þ\d„"«(]/

/**
 * Vị trí BẮT ĐẦU của từng câu trong `text` (luôn có 0). Dấu chấm sau viết tắt ("Tel.", "ca.", "max."), sau số
 * thứ tự ("1. Oktober", "3. Stock") hay trước chữ thường không tính là hết câu.
 */
export function sentenceStarts(text: string): number[] {
  const starts = [0]
  const re = /[.!?…]+["“”»)]*\s+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const next = m.index + m[0].length
    if (next >= text.length) break
    if (!UPPER_OR_DIGIT.test(text[next])) continue
    if (m[0][0] === '.') {
      const before = text.slice(0, m.index)
      // số thứ tự / ngày: chữ số ngay trước dấu chấm và sau đó là chữ cái
      if (/\d$/.test(before) && LETTER.test(text[next])) continue
      const word = /([A-Za-zÀ-ÖØ-öø-ÿ]+)$/.exec(before)?.[1]
      if (word && ABBR.has(word.toLowerCase())) continue
    }
    starts.push(next)
  }
  return starts
}

interface Cut {
  /** hết phần chữ hiện của tiêu đề */
  visible: number
  /** đầu phần kế tiếp */
  next: number
}

/** Dấu ngắt sớm nhất trong câu đầu `[0, end)` dùng làm ranh tiêu đề; `null` nếu không có. */
function headlineCut(text: string, end: number, hasMore: boolean): Cut | null {
  const first = text.slice(0, end)
  const cuts: Cut[] = []
  const add = (re: RegExp, visibleOffset: number) => {
    const m = re.exec(first)
    if (m) cuts.push({ visible: m.index + visibleOffset, next: m.index + m[0].length })
  }
  add(/:\s+/, 1) // "Hundebetreuung: Ich gehe…" — giữ dấu hai chấm
  add(/,\s+/, 0) // "Nachhilfe Mathe, Klasse 5–10…" — dấu phẩy thành dấu ngắt mềm
  add(/\s+[–—-]\s+/, 0)
  add(/\s+(?=\()/, 0) // "Babysitterin (Studentin, 23) hat…"
  if (hasMore) {
    // hết câu đầu: "?" / "!" ở lại với tiêu đề, dấu chấm thành dấu ngắt mềm
    const tail = /([.!?…]+["“”»)]*)(\s*)$/.exec(first)
    if (tail) {
      const punct = tail.index
      cuts.push({ visible: tail[1].startsWith('.') ? punct : punct + tail[1].length, next: end })
    } else {
      cuts.push({ visible: first.trimEnd().length, next: end })
    }
  }
  const lead = first.length - first.trimStart().length
  const ok = cuts
    .filter((c) => c.next < text.length && c.visible - lead >= 3 && c.visible - lead <= MAX_HEADLINE)
    .sort((a, b) => a.visible - b.visible)
  return ok[0] ?? null
}

/** Chia `[from, to)` thành các phần thân theo câu; câu cuối có dấu hiệu liên hệ thì tách phần liên hệ. */
function bodyAndContact(text: string, from: number, to: number): AdPart[] {
  if (from >= to) return []
  const starts = sentenceStarts(text.slice(from, to)).map((i) => i + from)
  const out: AdPart[] = []
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i]
    const e = i + 1 < starts.length ? starts[i + 1] : to
    if (text.slice(s, e).trim() === '') {
      // chỉ khoảng trắng: nhập vào phần trước (hoặc bỏ nếu không có)
      if (out.length > 0) out[out.length - 1].e = e
      else out.push({ role: 'body', s, e })
      continue
    }
    out.push({ role: 'body', s, e })
  }
  const last = out[out.length - 1]
  if (last) {
    const seg = text.slice(last.s, last.e)
    const key = CONTACT_INLINE.exec(seg)
    if (key) {
      const at = last.s + key.index + key[0].length - key[1].length
      if (text.slice(last.s, at).trim() === '') last.role = 'contact'
      else {
        last.e = at
        out.push({ role: 'contact', s: at, e: to })
      }
    } else if (looksLikeContact(seg)) {
      last.role = 'contact'
    }
  }
  return out
}

function parseLines(text: string): AdPart[] | null {
  // dòng không rỗng, kèm vị trí đầu
  const lines: Array<{ s: number; text: string }> = []
  let at = 0
  for (const line of text.split('\n')) {
    if (line.trim() !== '') lines.push({ s: at, text: line })
    at += line.length + 1
  }
  if (lines.length < 2) return null
  const parts: AdPart[] = lines.map((l, i) => ({
    role: 'body' as AdRole,
    s: i === 0 ? 0 : l.s,
    e: i + 1 < lines.length ? lines[i + 1].s : text.length,
  }))
  parts[0].role = 'headline'
  const lastIdx = parts.length - 1
  const hasContact = looksLikeContact(lines[lastIdx].text)
  if (hasContact) parts[lastIdx].role = 'contact'
  const bodyEnd = hasContact ? lastIdx : parts.length // các dòng [1, bodyEnd) là dòng phụ + thân
  if (bodyEnd - 1 >= 2) {
    const second = lines[1].text.trim()
    if (second.length <= MAX_TAGLINE && !/[.!?…:,;]$/.test(second) && !looksLikeContact(second)) parts[1].role = 'tagline'
  }
  return parts
}

/** Chữ của một mẩu rao vặt (đã chuẩn hoá xuống dòng như `blockText`) → các phần của áp phích. */
export function parseAdParts(text: string): AdParts {
  if (text.trim() === '') return { mode: 'plain', parts: text.length > 0 ? [{ role: 'body', s: 0, e: text.length }] : [] }

  const lines = parseLines(text)
  if (lines) return { mode: 'lines', parts: lines }

  const starts = sentenceStarts(text)
  const firstEnd = starts.length > 1 ? starts[1] : text.length
  const cut = headlineCut(text, firstEnd, starts.length > 1)
  if (!cut) return { mode: 'plain', parts: bodyAndContact(text, 0, text.length) }

  const head: AdPart = { role: 'headline', s: 0, e: cut.next }
  // dấu ngắt mềm = phần không phải khoảng trắng nằm giữa chữ hiện và phần kế (", " · ". " · " – ")
  if (text.slice(cut.visible, cut.next).trim() !== '') head.soft = cut.visible
  return { mode: 'inline', parts: [head, ...bodyAndContact(text, cut.next, text.length)] }
}

/** Ghép các phần lại — luôn bằng chuỗi gốc (dùng trong test và để tự kiểm). */
export function joinAdParts(text: string, parsed: AdParts): string {
  return parsed.parts.map((p) => text.slice(p.s, p.e)).join('')
}
