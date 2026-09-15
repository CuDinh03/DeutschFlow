// Leading glyph tile for roadmap/topic rows (Hạng mục C). Renders a Galerie glyph
// (mobile/GALERIE_GLYPHS.md) on a soft editorial tile in the warm-paper language —
// the rule-based, offline alternative to raster topic art. Key + tint come from
// `topicGlyph`; the key → glyph map below is the only place to extend.

import { View, type StyleProp, type ViewStyle } from 'react-native'
import { radius, useTheme } from '@/lib/theme'
import { matchTopicGlyph, topicGlyphColors, type GlyphKey } from '@/lib/topicGlyph'
import type { SkillNode } from '@/lib/skillTreeApi'
import type { GlyphName } from '@/lib/galerieGlyphs'
import { GaGlyph } from './GaGlyph'

const GLYPH_ICON: Record<GlyphKey, GlyphName> = {
  cafe: 't_cafe',
  food: 't_food',
  travel: 't_travel',
  greeting: 't_greeting',
  family: 't_family',
  time: 'thoigian',
  numbers: 't_numbers',
  shopping: 't_shopping',
  home: 't_home',
  work: 'phongvan',
  health: 't_health',
  culture: 't_culture',
  weather: 't_weather',
  communication: 't_communication',
  hobby: 't_hobby',
  exam: 't_exam',
  grammar: 'nguphap',
  default: 'hoc',
}

interface TopicGlyphTileProps {
  node: Pick<SkillNode, 'title' | 'tags' | 'coreTopics' | 'moduleTitle'>
  /** Square edge in px (icon scales to ~52%). */
  size?: number
  /** Dim to a neutral tile for locked rows. */
  muted?: boolean
  style?: StyleProp<ViewStyle>
}

export function TopicGlyphTile({ node, size = 40, muted = false, style }: TopicGlyphTileProps) {
  const c = useTheme().colors
  const { key, tint } = matchTopicGlyph(node)
  const { tileBg, iconColor } = topicGlyphColors(c, tint)
  const glyph = GLYPH_ICON[key]

  const bg = muted ? c.surfaceSunken : tileBg
  const fg = muted ? c.textFaint : iconColor

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius.sm,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <GaGlyph name={glyph} size={Math.round(size * 0.52)} inkColor={fg} goldColor={muted ? c.textFaint : c.accent} />
    </View>
  )
}
