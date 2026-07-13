// Topic → glyph mapping for the roadmap "Giai đoạn" rows (Hạng mục C).
// Pure, rule-based, offline: derives a Lucide icon key + editorial tint from a
// node's title/tags/topics so every lesson reads as an intentional glyph tile
// in the Galerie warm-paper language — no raster asset, no network, 0đ.
//
// This module stays RN-free (type-only imports) so it unit-tests under ts-jest.
// The GlyphKey → Lucide component map + tile rendering live in the RN component
// `components/ui/TopicGlyphTile.tsx`.

import type { ThemeColors } from '@/lib/theme'
import type { SkillNode } from '@/lib/skillTreeApi'

// Stable icon identity per topic. `default` is the fallback (BookOpen) when no
// keyword matches — never an empty tile.
export type GlyphKey =
  | 'cafe'
  | 'food'
  | 'travel'
  | 'greeting'
  | 'family'
  | 'time'
  | 'numbers'
  | 'shopping'
  | 'home'
  | 'work'
  | 'health'
  | 'culture'
  | 'weather'
  | 'communication'
  | 'hobby'
  | 'exam'
  | 'grammar'
  | 'default'

// Editorial hues carried by the theme (gold/red/blue/green + violet/teal/orange).
export type GlyphTint = 'gold' | 'brand' | 'info' | 'success' | 'violet' | 'teal' | 'orange'

export interface TopicGlyph {
  key: GlyphKey
  tint: GlyphTint
}

interface GlyphRule extends TopicGlyph {
  // Lowercased substrings tested against the node haystack. Keep both German
  // (lesson source) and Vietnamese (title_vi) terms so real titles match.
  keywords: string[]
}

// First match wins — order = priority. Narrow, high-signal terms first.
const RULES: readonly GlyphRule[] = [
  { key: 'cafe', tint: 'gold', keywords: ['café', 'cafe', 'kaffee', 'cà phê', 'quán', 'coffee', 'bestellen', 'getränk', 'trinken', 'đồ uống'] },
  { key: 'food', tint: 'orange', keywords: ['essen', 'restaurant', 'lebensmittel', 'frühstück', 'mittagessen', 'abendessen', 'kochen', 'món ăn', 'nhà hàng', 'nấu ăn', 'bữa ăn', 'ẩm thực'] },
  { key: 'travel', tint: 'violet', keywords: ['reise', 'urlaub', 'unterwegs', 'bahnhof', 'bahn', 'zug', 'ticket', 'fahrkarte', 'flughafen', 'ausflug', 'berlin', 'stadt', 'du lịch', 'tàu', 'sân bay', 'chuyến đi'] },
  { key: 'greeting', tint: 'teal', keywords: ['begrüß', 'kennenlernen', 'vorstellen', 'vorstellung', 'hallo', 'chào', 'làm quen', 'giới thiệu', 'greeting'] },
  { key: 'family', tint: 'orange', keywords: ['familie', 'freunde', 'kinder', 'eltern', 'gia đình', 'bạn bè', 'người thân', 'con cái'] },
  // `zeit` is intentionally absent — it substring-collides with `jahreszeit`
  // (weather) and `freizeit` (hobby). Match clock/appointment terms instead.
  { key: 'time', tint: 'info', keywords: ['uhrzeit', 'termin', 'kalender', 'wochentag', 'datum', 'thời gian', 'giờ giấc', 'lịch', 'cuộc hẹn', 'ngày trong tuần'] },
  // Shopping precedes numbers so a "#Einkaufen + #Zahlen" lesson reads as
  // ShoppingBag, not Hash (prices are part of the shopping topic).
  { key: 'shopping', tint: 'orange', keywords: ['einkauf', 'markt', 'geschäft', 'supermarkt', 'kleidung', 'mua sắm', 'chợ', 'siêu thị', 'cửa hàng', 'quần áo'] },
  // `nummer` dropped — collides with `telefonnummer` (communication).
  { key: 'numbers', tint: 'info', keywords: ['zahlen', 'zählen', 'số đếm', 'con số', 'đếm số'] },
  { key: 'work', tint: 'info', keywords: ['arbeit', 'beruf', 'büro', 'betrieb', 'kollege', 'công việc', 'nghề nghiệp', 'văn phòng', 'công sở'] },
  // Health precedes home so `krankenhaus` (hospital) beats home's `haus`.
  { key: 'health', tint: 'brand', keywords: ['gesundheit', 'arzt', 'körper', 'krank', 'apotheke', 'sức khỏe', 'bác sĩ', 'cơ thể', 'bệnh', 'nhà thuốc'] },
  { key: 'home', tint: 'teal', keywords: ['wohnung', 'haus', 'zuhause', 'möbel', 'zimmer', 'wohnen', 'nhà ở', 'căn hộ', 'nội thất', 'phòng'] },
  { key: 'culture', tint: 'violet', keywords: ['kultur', 'fest', 'tradition', 'feiertag', 'văn hóa', 'lễ hội', 'truyền thống', 'phong tục'] },
  { key: 'weather', tint: 'info', keywords: ['wetter', 'jahreszeit', 'klima', 'thời tiết', 'mùa', 'khí hậu'] },
  { key: 'communication', tint: 'teal', keywords: ['telefon', 'kommunikation', 'nachricht', 'điện thoại', 'giao tiếp', 'nhắn tin', 'gọi điện'] },
  { key: 'hobby', tint: 'success', keywords: ['hobby', 'freizeit', 'sport', 'musik', 'sở thích', 'giải trí', 'thể thao', 'âm nhạc'] },
  { key: 'exam', tint: 'gold', keywords: ['prüfung', 'wiederholung', 'test', 'luyện thi', 'kiểm tra', 'ôn tập', 'đề thi'] },
  // Grammar is the LAST specific rule: most nodes carry only grammar tags
  // (#Akkusativ, #Modalverben, #Perfekt…) with no topic keyword, so without
  // this they'd all collapse to the generic `default` glyph. Kept last so a
  // real topic (café, travel…) always wins over an incidental grammar tag.
  { key: 'grammar', tint: 'info', keywords: ['grammatik', 'akkusativ', 'dativ', 'nominativ', 'genitiv', 'modalverb', 'perfekt', 'präteritum', 'präsens', 'futur', 'konjunktiv', 'imperativ', 'artikel', 'adjektiv', 'pronomen', 'präposition', 'konjunktion', 'nebensatz', 'ngữ pháp', 'chia động từ', 'mạo từ', 'giống từ', 'thì '] },
] as const

const DEFAULT_GLYPH: TopicGlyph = { key: 'default', tint: 'gold' }

// Build a single lowercased search string from the node's semantic fields.
function haystackOf(node: Pick<SkillNode, 'title' | 'tags' | 'coreTopics' | 'moduleTitle'>): string {
  return [node.title, node.moduleTitle, ...(node.tags ?? []), ...(node.coreTopics ?? [])]
    .filter((s): s is string => Boolean(s))
    .join(' ')
    .toLowerCase()
}

/**
 * Resolve a node to its glyph identity (icon key + tint). Pure & deterministic.
 * Falls back to `default` (BookOpen/gold) so a tile is always shown.
 */
export function matchTopicGlyph(node: Pick<SkillNode, 'title' | 'tags' | 'coreTopics' | 'moduleTitle'>): TopicGlyph {
  const hay = haystackOf(node)
  for (const rule of RULES) {
    if (rule.keywords.some((k) => hay.includes(k))) {
      return { key: rule.key, tint: rule.tint }
    }
  }
  return DEFAULT_GLYPH
}

// Soft tile backgrounds for hues without a `*Soft` theme token.
const SOFT_TINT: Record<'violet' | 'teal' | 'orange', string> = {
  violet: 'rgba(124,86,200,0.14)',
  teal: 'rgba(17,136,138,0.14)',
  orange: 'rgba(224,123,57,0.15)',
}

// Darkened icon hues for the three tints whose theme foreground is too light to
// clear ≥3:1 (WCAG non-text) against its own pale tile — gold/orange/success.
// The other tints (brand/info/violet/teal) already pass with their base token.
const DARK_ICON: Record<'gold' | 'orange' | 'success', string> = {
  gold: '#6E5600', // deep mustard — reads on the pale-yellow accentSoft tile
  orange: '#A9500F', // burnt orange
  success: '#147A48', // forest green
}

export interface GlyphColors {
  tileBg: string
  iconColor: string
}

/**
 * Map a tint to concrete tile background + icon colour from the active theme.
 * Icon colours clear the 3:1 non-text-contrast bar against their own tile.
 */
export function topicGlyphColors(c: ThemeColors, tint: GlyphTint): GlyphColors {
  switch (tint) {
    case 'gold':
      return { tileBg: c.accentSoft, iconColor: DARK_ICON.gold }
    case 'brand':
      return { tileBg: c.brandSoft, iconColor: c.brand }
    case 'info':
      return { tileBg: c.infoSoft, iconColor: c.info }
    case 'success':
      return { tileBg: c.successSoft, iconColor: DARK_ICON.success }
    case 'violet':
      return { tileBg: SOFT_TINT.violet, iconColor: c.violet }
    case 'teal':
      return { tileBg: SOFT_TINT.teal, iconColor: c.teal }
    case 'orange':
      return { tileBg: SOFT_TINT.orange, iconColor: DARK_ICON.orange }
  }
}
