// Leading glyph tile for a vocabulary word (Hạng mục A). Renders a flat icon in
// the Galerie tile language when the word maps to a concrete object; renders
// nothing (null) for abstract/unknown words so the caller's layout falls back
// cleanly — no grey placeholder. Icon + tint come from `vocabGlyph`; the
// key → Lucide/Phosphor component map lives in `vocabIcons`.

import { View, type StyleProp, type ViewStyle } from 'react-native'
import { radius, useTheme } from '@/lib/theme'
import { topicGlyphColors } from '@/lib/topicGlyph'
import { resolveVocabGlyph } from '@/lib/vocabGlyph'
import { VocabIcon } from './vocabIcons'

interface VocabGlyphTileProps {
  german: string
  meaning?: string | null
  /** Square edge in px (icon scales to ~52%). */
  size?: number
  style?: StyleProp<ViewStyle>
}

/** Returns `null` (renders nothing) when the word has no concrete icon. */
export function VocabGlyphTile({ german, meaning, size = 40, style }: VocabGlyphTileProps) {
  const c = useTheme().colors
  const glyph = resolveVocabGlyph(german, meaning)
  if (!glyph) return null

  const { tileBg, iconColor } = topicGlyphColors(c, glyph.tint)

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius.sm,
          backgroundColor: tileBg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <VocabIcon glyphKey={glyph.key} size={Math.round(size * 0.52)} color={iconColor} />
    </View>
  )
}
