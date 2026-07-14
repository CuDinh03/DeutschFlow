// Vocabulary word → glyph mapping (Hạng mục A + B0, Tầng 1 — offline, free).
// Concrete A1–A2 nouns get a flat icon (Lucide + Phosphor) in the Galerie tile
// language; abstract/function words resolve to `null` (no icon, per D1 Tầng 3)
// rather than a forced placeholder. Exact-match on the German base word (article
// stripped) — precise, collision-free, unlike the topic substring matcher.
//
// B0 (14/07): the DE dict is mapped over the real seeded vocabulary (V9/V10/
// V154/V155) so most concrete nouns resolve offline. Farm animals, clothing and
// body parts that Lucide lacks are covered by Phosphor.
//
// RN-free (type-only imports) so it unit-tests under ts-jest. The key → icon
// component map (which library, which component) + tile rendering live in
// `components/ui/vocabIcons.tsx`. Forward-compatible: a backend `icon_key` can
// override this later.

import type { GlyphTint } from '@/lib/topicGlyph'

// Icon identity. `components/ui/vocabIcons.tsx` maps each key → a concrete
// Lucide or Phosphor component.
export type VocabIconKey =
  | 'apple' | 'cherry' | 'carrot' | 'banana' | 'egg' | 'fish' | 'meat' | 'bread'
  | 'pizza' | 'cake' | 'beer' | 'wine' | 'milk' | 'coffee' | 'soup' | 'water'
  | 'cheese' | 'citrus' | 'salad'
  | 'dog' | 'cat' | 'bird' | 'rabbit' | 'horse' | 'cow'
  | 'car' | 'bus' | 'bike' | 'train' | 'plane' | 'ship'
  | 'house' | 'door' | 'bed' | 'chair' | 'lamp' | 'table'
  | 'sun' | 'sunrise' | 'sunset' | 'moon' | 'cloud' | 'rain' | 'snow' | 'star' | 'weather'
  | 'flower' | 'tree' | 'forest' | 'leaf' | 'mountain' | 'sea' | 'park'
  | 'book' | 'pencil' | 'backpack' | 'school' | 'university' | 'scissors' | 'newspaper'
  | 'clock' | 'calendar' | 'phone' | 'computer' | 'camera' | 'tv' | 'music'
  | 'key' | 'gift' | 'heart' | 'umbrella' | 'glasses' | 'bag'
  | 'shirt' | 'pants' | 'dress' | 'jacket' | 'shoe' | 'boot' | 'hat' | 'sock'
  | 'money' | 'coins' | 'card'
  | 'baby' | 'person' | 'people' | 'hand' | 'eye' | 'ear' | 'face' | 'tooth' | 'foot'
  | 'doctor' | 'nurse' | 'pill' | 'hospital'
  | 'globe' | 'building' | 'store' | 'church' | 'hotel' | 'office' | 'police' | 'chef'

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
  cheese: 'gold', citrus: 'orange', salad: 'success',
  dog: 'orange', cat: 'orange', bird: 'teal', rabbit: 'orange', horse: 'orange', cow: 'orange',
  car: 'violet', bus: 'violet', bike: 'violet', train: 'violet', plane: 'violet', ship: 'violet',
  house: 'teal', door: 'teal', bed: 'teal', chair: 'teal', lamp: 'gold', table: 'teal',
  sun: 'gold', sunrise: 'gold', sunset: 'orange', moon: 'violet', cloud: 'info', rain: 'info', snow: 'info', star: 'gold', weather: 'info',
  flower: 'success', tree: 'success', forest: 'success', leaf: 'success', mountain: 'teal', sea: 'info', park: 'success',
  book: 'info', pencil: 'gold', backpack: 'orange', school: 'info', university: 'gold',
  scissors: 'info', newspaper: 'info',
  clock: 'info', calendar: 'info', phone: 'info', computer: 'info', camera: 'violet',
  tv: 'info', music: 'violet',
  key: 'gold', gift: 'brand', heart: 'brand', umbrella: 'info', glasses: 'info', bag: 'orange',
  shirt: 'violet', pants: 'violet', dress: 'violet', jacket: 'violet', shoe: 'violet', boot: 'violet', hat: 'violet', sock: 'violet',
  money: 'success', coins: 'gold', card: 'info',
  baby: 'orange', person: 'info', people: 'orange', hand: 'brand', eye: 'info', ear: 'brand', face: 'brand', tooth: 'brand', foot: 'brand',
  doctor: 'brand', nurse: 'brand', pill: 'brand', hospital: 'brand',
  globe: 'info', building: 'info', store: 'orange', church: 'violet', hotel: 'violet', office: 'info', police: 'info', chef: 'gold',
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
  schirm: 'umbrella', brille: 'glasses', kleidung: 'shirt',
  // No skirt/coat icon in either lib → Rock (skirt) & Mantel (coat) stay null
  // rather than duplicate Kleid's dress / Jacke's jacket in the same lesson.
  hemd: 'shirt', kleid: 'dress', hose: 'pants', jacke: 'jacket',
  schuh: 'shoe', stiefel: 'boot', hut: 'hat', mütze: 'hat', socke: 'sock',
  einkaufstasche: 'bag', geld: 'money', münze: 'coins', kreditkarte: 'card', karte: 'card',
  baby: 'baby', kind: 'baby', mann: 'person', frau: 'person', person: 'person',
  // Kopf (head) → null: no head/bust icon exists; a full-person silhouette next
  // to the precise eye/ear/tooth glyphs would read as "person", not "head".
  vater: 'person', mutter: 'person', sohn: 'person', tochter: 'person',
  bruder: 'person', schwester: 'person',
  familie: 'people', leute: 'people', freund: 'people', freundin: 'people',
  hand: 'hand', finger: 'hand', auge: 'eye', ohr: 'ear', mund: 'face', zahn: 'tooth', fuß: 'foot', fuss: 'foot',
  arzt: 'doctor', ärztin: 'doctor', tablette: 'pill', medikament: 'pill',
  krankenhaus: 'hospital', welt: 'globe', erde: 'globe', land: 'globe', gebäude: 'building', stadt: 'building',
  geschäft: 'store', laden: 'store', supermarkt: 'store', kirche: 'church', hotel: 'hotel',
  // B0 expansion — concrete nouns from the seeded A1 vocab (V9/V10/V154/V155).
  tisch: 'table', käse: 'cheese', orange: 'citrus', salat: 'salad',
  // Schwein/Schaf/Löwe → null: no pig/sheep/lion icon; a generic paw or a house-
  // cat glyph (next to the real "Katze" card) would misidentify the animal.
  pferd: 'horse', kuh: 'cow', huhn: 'bird',
  bahnhof: 'train', flughafen: 'plane', park: 'park', büro: 'office', angestellter: 'office',
  lehrer: 'university', lehrerin: 'university', krankenschwester: 'nurse',
  polizist: 'police', bäcker: 'chef', metzger: 'meat', friseur: 'scissors',
  // `morgen` = the noun "Morgen" (morning). A future adverb "morgen" (tomorrow)
  // would want no sunrise icon — guard if such a card is ever seeded.
  tag: 'sun', morgen: 'sunrise', abend: 'sunset', jahr: 'calendar', woche: 'calendar',
  monat: 'calendar', wetter: 'weather',
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
