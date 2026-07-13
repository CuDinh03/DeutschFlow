import { matchTopicGlyph, topicGlyphColors, type GlyphKey } from '@/lib/topicGlyph'
import { lightColors } from '@/lib/theme/themes'
import type { SkillNode } from '@/lib/skillTreeApi'

type GlyphInput = Pick<SkillNode, 'title' | 'tags' | 'coreTopics' | 'moduleTitle'>

const node = (over: Partial<GlyphInput>): GlyphInput => ({
  title: '',
  tags: [],
  coreTopics: [],
  moduleTitle: null,
  ...over,
})

describe('matchTopicGlyph', () => {
  const cases: [string, GlyphInput, GlyphKey][] = [
    ['German café title', node({ title: 'Im Café bestellen' }), 'cafe'],
    ['German travel title', node({ title: 'Unterwegs in Berlin' }), 'travel'],
    ['Vietnamese greeting title', node({ title: 'Chào hỏi và làm quen' }), 'greeting'],
    ['Vietnamese family title', node({ title: 'Gia đình của tôi' }), 'family'],
    ['time title', node({ title: 'Die Uhrzeit' }), 'time'],
    ['health via German title', node({ title: 'Beim Arzt' }), 'health'],
    ['work via Vietnamese title', node({ title: 'Công việc hằng ngày' }), 'work'],
  ]

  test.each(cases)('%s → %s', (_label, input, expected) => {
    expect(matchTopicGlyph(input).key).toBe(expected)
  })

  test('matches on tags when the title is generic', () => {
    expect(matchTopicGlyph(node({ title: 'Lektion 5', tags: ['einkaufen', 'markt'] })).key).toBe('shopping')
  })

  test('grammar-only nodes get the grammar glyph, not the generic default', () => {
    expect(matchTopicGlyph(node({ title: 'Ngày 8', tags: ['#Akkusativ', '#Modalverben'] })).key).toBe('grammar')
    expect(matchTopicGlyph(node({ title: 'Das Perfekt' })).key).toBe('grammar')
  })

  test('shopping outranks numbers when a lesson tags both (prices are shopping)', () => {
    expect(matchTopicGlyph(node({ title: 'Ngày 19', tags: ['#Einkaufen', '#Zahlen'] })).key).toBe('shopping')
  })

  test('a real topic still wins over an incidental grammar tag', () => {
    expect(matchTopicGlyph(node({ title: 'Im Café bestellen', tags: ['#Akkusativ'] })).key).toBe('cafe')
  })

  test('matches on coreTopics when title and tags miss', () => {
    expect(matchTopicGlyph(node({ title: 'Ngày 12', coreTopics: ['Wetter und Jahreszeiten'] })).key).toBe('weather')
  })

  test('is case-insensitive', () => {
    expect(matchTopicGlyph(node({ title: 'KAFFEE UND KUCHEN' })).key).toBe('cafe')
  })

  test('falls back to default (never empty) for unmatched topics', () => {
    const g = matchTopicGlyph(node({ title: 'xyzzy qwerty' }))
    expect(g.key).toBe('default')
    expect(g.tint).toBe('gold')
  })

  test('priority: first rule wins when several keywords co-occur', () => {
    // "café" (rule 1) outranks "essen" (rule 2) when both appear.
    expect(matchTopicGlyph(node({ title: 'Café und Essen' })).key).toBe('cafe')
  })

  test('tolerates undefined tags/coreTopics without throwing', () => {
    const input = { title: 'Reise nach Wien' } as GlyphInput
    expect(matchTopicGlyph(input).key).toBe('travel')
  })
})

describe('topicGlyphColors', () => {
  // sRGB relative luminance + WCAG contrast, so the 3:1 non-text bar is asserted,
  // not just the concrete hex. Translucent tiles are composited over the surface.
  const lum = (hex: string): number => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  }
  // Composite an "rgba(r,g,b,a)" or opaque hex tile over the given surface hex.
  const flatten = (tile: string, surface: string): string => {
    const m = tile.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/)
    if (!m) return tile // opaque hex already
    const [, r, g, b, a] = m
    const s = [1, 3, 5].map((i) => parseInt(surface.slice(i, i + 2), 16))
    const mix = (c: number, sc: number) => Math.round(Number(a) * c + (1 - Number(a)) * sc)
    const hx = (n: number) => n.toString(16).padStart(2, '0')
    return `#${hx(mix(+r, s[0]))}${hx(mix(+g, s[1]))}${hx(mix(+b, s[2]))}`
  }
  const contrast = (fg: string, bgTile: string): number => {
    const bg = flatten(bgTile, lightColors.surface)
    const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a)
    return (hi + 0.05) / (lo + 0.05)
  }

  const TINTS = ['gold', 'brand', 'info', 'success', 'violet', 'teal', 'orange'] as const

  test('gold tile keeps the accent-soft background', () => {
    expect(topicGlyphColors(lightColors, 'gold').tileBg).toBe(lightColors.accentSoft)
  })

  test('every tint clears the 3:1 non-text-contrast bar (icon vs its own tile)', () => {
    for (const t of TINTS) {
      const { tileBg, iconColor } = topicGlyphColors(lightColors, t)
      expect(contrast(iconColor, tileBg)).toBeGreaterThanOrEqual(3)
    }
  })

  test('gold/orange/success use darkened icons (not the too-light base token)', () => {
    expect(topicGlyphColors(lightColors, 'gold').iconColor).not.toBe(lightColors.accentText)
    expect(topicGlyphColors(lightColors, 'orange').iconColor).not.toBe(lightColors.orange)
    expect(topicGlyphColors(lightColors, 'success').iconColor).not.toBe(lightColors.success)
  })

  test('well-contrasted tints keep their base theme token', () => {
    expect(topicGlyphColors(lightColors, 'brand').iconColor).toBe(lightColors.brand)
    expect(topicGlyphColors(lightColors, 'info').iconColor).toBe(lightColors.info)
    expect(topicGlyphColors(lightColors, 'violet').iconColor).toBe(lightColors.violet)
    expect(topicGlyphColors(lightColors, 'teal').iconColor).toBe(lightColors.teal)
  })
})
