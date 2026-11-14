/**
 * Khuôn áp phích cho mẩu rao vặt telc Lesen Teil 3 (14/11/2026) — chọn khuôn và hình minh hoạ. Phép thuần:
 * cùng một bộ mẩu ⇒ cùng một cách gán trên mọi máy, mọi lần vẽ (hạt giống là băm của chính chữ các mẩu).
 */
import type { AdParts } from './adParts'

/** 12 khuôn; kiểu dáng ở `src/styles/ad-posters.css` (`.ad-poster[data-tpl="…"]`). */
export const POSTER_TEMPLATES = [
  'rahmen', // khung viền + dải trên
  'grau', // hộp xám, chữ nghiêng canh giữa
  'rechts', // canh phải, vạch dọc bên phải
  'band', // dải tối vắt ngang giữa
  'schraeg', // tiêu đề trên dải tối hơi nghiêng
  'pixel', // tiêu đề chữ điểm ảnh / máy chữ, viền đứt
  'liste', // danh sách gạch đầu dòng
  'hand', // tiêu đề chữ viết tay
  'plakat', // tiêu đề serif đậm, khung kép
  'schmal', // tiêu đề chữ hẹp in hoa giữa hai vạch đậm
  'bild', // hình minh hoạ lớn canh giữa
  'schlicht', // trơn — dùng được cho mọi mẩu
] as const

export type PosterTemplate = (typeof POSTER_TEMPLATES)[number]

/** Khuôn không cần tiêu đề (mẩu `plain`). */
const NO_HEADLINE_OK: ReadonlySet<PosterTemplate> = new Set<PosterTemplate>(['schlicht', 'grau', 'rechts'])
/** Khuôn cần ít nhất hai phần thân (gạch đầu dòng; dải giữa cần chữ ở trên và dưới). */
const NEEDS_TWO_BODY: ReadonlySet<PosterTemplate> = new Set<PosterTemplate>(['liste', 'band'])
/** Khuôn có chỗ cho hình minh hoạ. */
export const TEMPLATES_WITH_ICON: ReadonlySet<PosterTemplate> = new Set<PosterTemplate>(['rahmen', 'grau', 'liste', 'hand', 'plakat', 'bild'])

export function templateFits(tpl: PosterTemplate, parsed: AdParts): boolean {
  if (parsed.mode === 'plain') return NO_HEADLINE_OK.has(tpl)
  if (NEEDS_TWO_BODY.has(tpl)) return parsed.parts.filter((p) => p.role === 'body' || p.role === 'tagline').length >= 2
  return true
}

/** FNV-1a 32 bit. */
export function hashText(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface AdForTemplate {
  key: string
  parsed: AdParts
  text: string
}

/**
 * Gán khuôn cho từng mẩu của một Teil. Thứ tự khuôn xáo theo hạt giống (băm chữ của cả bộ mẩu); mẩu kén khuôn
 * nhất chọn trước; mỗi mẩu lấy khuôn hợp ít được dùng nhất ⇒ 12 mẩu dùng khuôn khác nhau chừng nào số khuôn
 * hợp còn đủ (mẩu `plain` chỉ có 3 khuôn hợp nên từ mẩu `plain` thứ tư trở đi buộc phải lặp).
 */
export function assignTemplates(ads: readonly AdForTemplate[]): Record<string, PosterTemplate> {
  const rnd = mulberry32(hashText(ads.map((a) => `${a.key}\u0000${a.text}`).join('\u0001')))
  const order: PosterTemplate[] = [...POSTER_TEMPLATES]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const fitting = ads.map((a) => order.filter((tpl) => templateFits(tpl, a.parsed)))
  const queue = ads.map((_, i) => i).sort((x, y) => fitting[x].length - fitting[y].length || x - y)
  const used = new Map<PosterTemplate, number>()
  const out: Record<string, PosterTemplate> = {}
  for (const i of queue) {
    let best: PosterTemplate = 'schlicht'
    let bestCount = Infinity
    for (const tpl of fitting[i]) {
      const n = used.get(tpl) ?? 0
      if (n < bestCount) {
        best = tpl
        bestCount = n
      }
    }
    used.set(best, (used.get(best) ?? 0) + 1)
    out[ads[i].key] = best
  }
  return out
}

export type AdIconKey =
  | 'bike' | 'truck' | 'car' | 'plane' | 'music' | 'theater' | 'food' | 'sport' | 'pet' | 'camera' | 'sewing'
  | 'paint' | 'course' | 'kids' | 'book' | 'tech' | 'furniture' | 'home' | 'job'

/** Từ khoá (chữ thường, khớp chuỗi con trong TIÊU ĐỀ) → hình. Hàng trên thắng hàng dưới. */
const ICON_RULES: ReadonlyArray<[AdIconKey, RegExp]> = [
  ['bike', /fahrrad|e-bike|räder\b/],
  ['truck', /umzug|transport/],
  ['car', /auto|mitfahr|fahrdienst|führerschein|fahrschule|übungsfahrt|garage|taxi/],
  ['plane', /flug|flüge|flieg|reise|urlaub/],
  ['music', /musik|konzert|gitarre|klavier|chor\b|gesang/],
  ['theater', /theater|kino|bühne/],
  ['food', /essen|restaurant|koch|köch|catering|partyservice|buffet|café/],
  ['sport', /sport|yoga|schwimm|tanz|fitness|wander|fußball|lauftreff/],
  ['pet', /hund|katze|tier/],
  ['camera', /foto/],
  ['sewing', /näh|friseur|schneider/],
  ['paint', /maler|renovier/],
  ['course', /kurs|unterricht|nachhilfe|lernen|hausaufgaben|konversation|schule/],
  ['kids', /kinder|baby|ferien|au-pair|spielzeug/],
  ['book', /buch|bücher/],
  ['tech', /computer|laptop|handy|technik|tablet|drucker/],
  ['furniture', /möbel|sofa|bett\b|kleiderschrank|\bschrank|tisch\b/],
  ['home', /wohnung|zimmer|\bwg\b|nachmieter|mitbewohner/],
  ['job', /\bjob|stelle\b|aushilfe|reinigungskraft|mitarbeiter|arbeit/],
]

/** Hình minh hoạ theo tiêu đề của mẩu (mẩu `plain`: 60 ký tự đầu); không khớp gì ⇒ `null` (không vẽ hình). */
export function adIcon(text: string, parsed: AdParts): AdIconKey | null {
  const head = parsed.parts.find((p) => p.role === 'headline')
  const probe = (head ? text.slice(head.s, head.soft ?? head.e) : text.slice(0, 60)).toLowerCase()
  for (const [key, re] of ICON_RULES) if (re.test(probe)) return key
  return null
}
