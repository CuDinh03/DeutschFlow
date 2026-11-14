/**
 * Khuôn áp phích cho mẩu rao vặt telc Lesen Teil 3 (14/11/2026) — chọn khuôn và hình minh hoạ. Phép thuần:
 * cùng một bộ mẩu ⇒ cùng một cách gán trên mọi máy, mọi lần vẽ (hạt giống là băm của chính chữ các mẩu).
 */
import type { AdPart, AdParts } from './adParts'

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
/** Khuôn có chỗ cho hình minh hoạ. */
export const TEMPLATES_WITH_ICON: ReadonlySet<PosterTemplate> = new Set<PosterTemplate>(['rahmen', 'grau', 'liste', 'hand', 'plakat', 'bild'])
/** Dải tối của khuôn `band` chỉ nhận một cụm ngắn — câu dài trong dải tối trông nặng và khó đọc. */
export const MAX_BAND_CHARS = 40

const bodyParts = (parsed: AdParts) => parsed.parts.filter((p) => p.role === 'body' || p.role === 'tagline')

/** Phần đặt vào dải tối của khuôn `band`: dòng phụ, không có thì phần thân đầu. */
export function bandPart(parsed: AdParts): AdPart | undefined {
  return parsed.parts.find((p) => p.role === 'tagline') ?? parsed.parts.find((p) => p.role === 'body')
}

export function templateFits(tpl: PosterTemplate, parsed: AdParts, text: string): boolean {
  if (parsed.mode === 'plain') return NO_HEADLINE_OK.has(tpl)
  // gạch đầu dòng cần ít nhất hai dòng
  if (tpl === 'liste') return bodyParts(parsed).length >= 2
  if (tpl === 'band') {
    // dải giữa cần chữ ở trên và dưới, và cụm vào dải phải ngắn
    const band = bandPart(parsed)
    return bodyParts(parsed).length >= 2 && !!band && text.slice(band.s, band.e).trim().length <= MAX_BAND_CHARS
  }
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
  const fitting = ads.map((a) => order.filter((tpl) => templateFits(tpl, a.parsed, a.text)))
  // khuôn càng ít mẩu hợp càng "hiếm": khi hoà số lần dùng thì ưu tiên khuôn hiếm, để khuôn hiếm không bị bỏ trống
  const rarity = new Map<PosterTemplate, number>()
  for (const list of fitting) for (const tpl of list) rarity.set(tpl, (rarity.get(tpl) ?? 0) + 1)
  const queue = ads.map((_, i) => i).sort((x, y) => fitting[x].length - fitting[y].length || x - y)
  const used = new Map<PosterTemplate, number>()
  const out: Record<string, PosterTemplate> = {}
  for (const i of queue) {
    let best: PosterTemplate = 'schlicht'
    let bestCount = Infinity
    let bestRarity = Infinity
    for (const tpl of fitting[i]) {
      const n = used.get(tpl) ?? 0
      const r = rarity.get(tpl) ?? 0
      if (n < bestCount || (n === bestCount && r < bestRarity)) {
        best = tpl
        bestCount = n
        bestRarity = r
      }
    }
    used.set(best, (used.get(best) ?? 0) + 1)
    out[ads[i].key] = best
  }
  return out
}

export type AdIconKey =
  | 'bike' | 'truck' | 'car' | 'plane' | 'music' | 'theater' | 'food' | 'fitness' | 'swim' | 'hike' | 'dog' | 'cat'
  | 'camera' | 'sewing' | 'paint' | 'course' | 'kids' | 'book' | 'tech' | 'bed' | 'furniture' | 'home' | 'job'

/** `<` = đầu từ, `>` = cuối từ (tự viết vì `\b` của JS không hiểu ä ö ü ß). */
function rule(src: string): RegExp {
  return new RegExp(src.replace(/</g, '(?:^|[^a-zäöüß])').replace(/>/g, '(?![a-zäöüß])'))
}

/**
 * Từ khoá (chữ thường, trong TIÊU ĐỀ) → hình. Hàng trên thắng hàng dưới. Chỉ gán khi hình thật sự đúng nghĩa
 * (rà lại 14/11/2026): hàng `null` chặn những chủ đề không có hình hợp — Yoga, Tanz, Gymnastik không nhận quả tạ
 * hay mũ tốt nghiệp của "…kurs"; từ khoá chung chung dễ khớp nhầm (auto trong "Automat", buch trong "buchen",
 * essen trong "Interessen", tier trong "Quartier", ferien trong "Ferienwohnung", stelle trong "Baustelle",
 * arbeit trong "Gartenarbeit", flug trong "Ausflug") đều buộc khớp theo ranh từ hoặc đã bỏ.
 */
const ICON_RULES: ReadonlyArray<[AdIconKey | null, RegExp]> = [
  [null, rule('yoga|<tanz|<tänze|salsa|zumba|pilates|gymnastik|ballett')],
  ['bike', rule('fahrrad|fahrräder|e-bike')],
  ['truck', rule('umzug>|umzüge|umzugshelfer|umzugshilfe|umzugsservice|transporter')],
  ['car', rule('<autos?>|mitfahr|fahrdienst|führerschein|fahrschule|übungsfahrt|<garage|<taxi')],
  ['plane', rule('<flug|<flüge|<fliegen|<reisen?>|reisebüro|urlaub')],
  ['music', rule('musik|konzert|gitarre|klavier|<chor>|gesang')],
  ['theater', rule('theater|<bühne')],
  ['food', rule('<essen>|restaurant|kochkurs|kochabend|<kochen>|<koch>|köchin|catering|partyservice|buffet|<café')],
  ['swim', rule('schwimm')],
  ['hike', rule('wander')],
  ['fitness', rule('fitness|krafttraining|<sport')],
  ['dog', rule('<hund')],
  ['cat', rule('<katze')],
  ['camera', rule('<foto')],
  ['sewing', rule('<näh|friseur|schneiderei')],
  ['paint', rule('<maler|renovier')],
  ['course', rule('kurs>|kurse>|unterricht|nachhilfe|hausaufgaben|konversation')],
  ['bed', rule('bett>|betten>')],
  ['kids', rule('<kinder|<baby|au-pair|spielzeug')],
  ['book', rule('<buch>|bücher')],
  ['tech', rule('computer|laptop|<handy|<tablet|drucker')],
  ['furniture', rule('möbel|<sofa|<sessel|<couch')],
  ['home', rule('wohnung|zimmer|<wg>|nachmieter|mitbewohner')],
  ['job', rule('<jobs?>|minijob|nebenjob|aushilfe|reinigungskraft|mitarbeiter|stellenangebot')],
]

/** Hình minh hoạ theo tiêu đề của mẩu (mẩu `plain`: 60 ký tự đầu); không khớp gì ⇒ `null` (không vẽ hình). */
export function adIcon(text: string, parsed: AdParts): AdIconKey | null {
  const head = parsed.parts.find((p) => p.role === 'headline')
  const probe = (head ? text.slice(head.s, head.soft ?? head.e) : text.slice(0, 60)).toLowerCase()
  for (const [key, re] of ICON_RULES) if (re.test(probe)) return key
  return null
}
