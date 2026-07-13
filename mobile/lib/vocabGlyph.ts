// Vocabulary word → glyph mapping (Hạng mục A, Tầng 1 — offline, free).
// Concrete A1–A2 nouns get a flat Lucide icon in the Galerie tile language;
// abstract/function words resolve to `null` (no icon, per D1 Tầng 3) rather
// than a forced placeholder. Exact-match on the German base word (article
// stripped) — precise, collision-free, unlike the topic substring matcher.
//
// RN-free (type-only imports) so it unit-tests under ts-jest. The key → Lucide
// component map + tile rendering live in `components/ui/VocabGlyphTile.tsx`.
// Forward-compatible: a backend-supplied `icon_key` (B0/LLM) can override this.

import type { GlyphTint } from '@/lib/topicGlyph'

// Icon identity. The component maps each key → a concrete Lucide component.
export type VocabIconKey =
  | 'apple' | 'cherry' | 'carrot' | 'banana' | 'egg' | 'fish' | 'meat' | 'bread'
  | 'pizza' | 'cake' | 'beer' | 'wine' | 'milk' | 'coffee' | 'soup' | 'water'
  | 'dog' | 'cat' | 'bird' | 'rabbit'
  | 'car' | 'bus' | 'bike' | 'train' | 'plane' | 'ship'
  | 'house' | 'door' | 'bed' | 'chair' | 'lamp'
  | 'sun' | 'moon' | 'cloud' | 'rain' | 'snow' | 'star' | 'flower' | 'tree'
  | 'forest' | 'leaf' | 'mountain' | 'sea'
  | 'book' | 'pencil' | 'backpack' | 'school' | 'university' | 'scissors' | 'newspaper'
  | 'clock' | 'calendar' | 'phone' | 'computer' | 'camera' | 'tv' | 'music'
  | 'key' | 'gift' | 'heart' | 'umbrella' | 'glasses' | 'shirt' | 'bag'
  | 'money' | 'coins' | 'card'
  | 'baby' | 'person' | 'people' | 'hand' | 'eye'
  | 'doctor' | 'pill' | 'hospital'
  | 'globe' | 'building' | 'store' | 'church' | 'hotel'

export interface VocabGlyph {
  key: VocabIconKey
  tint: GlyphTint
}

// Editorial tint per icon — grouped by sense (food warm, transport violet,
// nature green, objects/info blue, body/health red, home teal).
const TINT: Record<VocabIconKey, GlyphTint> = {
  apple: 'orange', cherry: 'brand', carrot: 'orange', banana: 'gold', egg: 'gold',
  fish: 'info', meat: 'brand', bread: 'gold', pizza: 'brand', cake: 'brand',
  beer: 'gold', wine: 'brand', milk: 'info', coffee: 'gold', soup: 'orange', water: 'info',
  dog: 'orange', cat: 'orange', bird: 'teal', rabbit: 'orange',
  car: 'violet', bus: 'violet', bike: 'violet', train: 'violet', plane: 'violet', ship: 'violet',
  house: 'teal', door: 'teal', bed: 'teal', chair: 'teal', lamp: 'gold',
  sun: 'gold', moon: 'violet', cloud: 'info', rain: 'info', snow: 'info', star: 'gold',
  flower: 'success', tree: 'success', forest: 'success', leaf: 'success', mountain: 'teal', sea: 'info',
  book: 'info', pencil: 'gold', backpack: 'orange', school: 'info', university: 'gold',
  scissors: 'info', newspaper: 'info',
  clock: 'info', calendar: 'info', phone: 'info', computer: 'info', camera: 'violet',
  tv: 'info', music: 'violet',
  key: 'gold', gift: 'brand', heart: 'brand', umbrella: 'info', glasses: 'info', shirt: 'violet', bag: 'orange',
  money: 'success', coins: 'gold', card: 'info',
  baby: 'orange', person: 'info', people: 'orange', hand: 'brand', eye: 'info',
  doctor: 'brand', pill: 'brand', hospital: 'brand',
  globe: 'info', building: 'info', store: 'orange', church: 'violet', hotel: 'violet',
}

// German base word (lowercased, article-stripped) → icon key. Many-to-one.
const DE_DICT: Record<string, VocabIconKey> = {
  apfel: 'apple', obst: 'apple', kirsche: 'cherry', karotte: 'carrot', möhre: 'carrot',
  gemüse: 'carrot', banane: 'banana', ei: 'egg', fisch: 'fish', fleisch: 'meat',
  brot: 'bread', brötchen: 'bread', pizza: 'pizza', kuchen: 'cake', torte: 'cake',
  bier: 'beer', wein: 'wine', milch: 'milk', kaffee: 'coffee',
  suppe: 'soup', wasser: 'water',
  hund: 'dog', katze: 'cat', vogel: 'bird', kaninchen: 'rabbit', hase: 'rabbit',
  auto: 'car', wagen: 'car', bus: 'bus', fahrrad: 'bike', rad: 'bike',
  zug: 'train', bahn: 'train', flugzeug: 'plane', schiff: 'ship', boot: 'ship',
  haus: 'house', wohnung: 'house', tür: 'door', bett: 'bed', stuhl: 'chair',
  sessel: 'chair', lampe: 'lamp',
  sonne: 'sun', mond: 'moon', wolke: 'cloud', regen: 'rain', schnee: 'snow', stern: 'star',
  blume: 'flower', baum: 'tree', wald: 'forest', blatt: 'leaf', berg: 'mountain',
  meer: 'sea', see: 'sea',
  buch: 'book', heft: 'book', bleistift: 'pencil', stift: 'pencil', kuli: 'pencil',
  rucksack: 'backpack', tasche: 'backpack', schule: 'school', universität: 'university',
  uni: 'university', schere: 'scissors', zeitung: 'newspaper',
  uhr: 'clock', kalender: 'calendar', handy: 'phone', telefon: 'phone',
  computer: 'computer', laptop: 'computer', kamera: 'camera', fotoapparat: 'camera',
  fernseher: 'tv', musik: 'music', lied: 'music',
  schlüssel: 'key', geschenk: 'gift', herz: 'heart', regenschirm: 'umbrella',
  schirm: 'umbrella', brille: 'glasses', hemd: 'shirt', kleid: 'shirt', kleidung: 'shirt',
  einkaufstasche: 'bag', geld: 'money', münze: 'coins', kreditkarte: 'card', karte: 'card',
  baby: 'baby', kind: 'baby', mann: 'person', frau: 'person', person: 'person',
  familie: 'people', leute: 'people', freund: 'people', freundin: 'people',
  hand: 'hand', auge: 'eye',
  arzt: 'doctor', ärztin: 'doctor', tablette: 'pill', medikament: 'pill',
  krankenhaus: 'hospital', welt: 'globe', erde: 'globe', gebäude: 'building',
  geschäft: 'store', laden: 'store', supermarkt: 'store', kirche: 'church', hotel: 'hotel',
}

// Vietnamese-meaning fallback (substring) for the highest-frequency words, so a
// word whose German base isn't in DE_DICT can still resolve from its meaning.
const VI_KEYWORDS: readonly [string, VocabIconKey][] = [
  ['quả táo', 'apple'], ['trái táo', 'apple'], ['cà rốt', 'carrot'], ['chuối', 'banana'], ['trứng', 'egg'],
  ['con cá', 'fish'], ['thịt', 'meat'], ['bánh mì', 'bread'], ['cà phê', 'coffee'],
  ['sữa', 'milk'], ['con chó', 'dog'], ['con mèo', 'cat'],
  ['con chim', 'bird'], ['ô tô', 'car'], ['xe hơi', 'car'], ['xe buýt', 'bus'],
  ['xe đạp', 'bike'], ['tàu hỏa', 'train'], ['máy bay', 'plane'], ['ngôi nhà', 'house'],
  ['giường', 'bed'], ['cái ghế', 'chair'], ['mặt trời', 'sun'],
  ['mặt trăng', 'moon'], ['bông hoa', 'flower'], ['cái cây', 'tree'], ['quyển sách', 'book'],
  ['cuốn sách', 'book'], ['đồng hồ', 'clock'], ['điện thoại', 'phone'], ['chìa khóa', 'key'],
  ['trái tim', 'heart'], ['tiền mặt', 'money'], ['số tiền', 'money'], ['bác sĩ', 'doctor'], ['bệnh viện', 'hospital'],
  ['gia đình', 'people'], ['em bé', 'baby'], ['bàn tay', 'hand'], ['đôi mắt', 'eye'],
]

// Lowercase, drop a leading German article, strip surrounding punctuation.
function normalizeGerman(word: string): string {
  return word
    .toLowerCase()
    .trim()
    .replace(/^(der|die|das)\s+/, '')
    .replace(/[.,;:!?"'()]/g, '')
    .trim()
}

/**
 * Resolve a vocabulary entry to its glyph, or `null` when no concrete icon fits
 * (abstract/function words). German base word is matched first (exact), then a
 * few Vietnamese meaning keywords. Pure & deterministic.
 */
export function resolveVocabGlyph(german: string, meaning?: string | null): VocabGlyph | null {
  const deKey = DE_DICT[normalizeGerman(german)]
  if (deKey) return { key: deKey, tint: TINT[deKey] }

  if (meaning) {
    const hay = meaning.toLowerCase()
    for (const [kw, key] of VI_KEYWORDS) {
      if (hay.includes(kw)) return { key, tint: TINT[key] }
    }
  }
  return null
}
