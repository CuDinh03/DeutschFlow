// Leading glyph tile for roadmap/topic rows (Hạng mục C). Renders a Lucide icon
// on a soft editorial tile in the Galerie warm-paper language — the rule-based,
// offline alternative to raster topic art. Icon + tint come from `topicGlyph`.

import { View, type StyleProp, type ViewStyle } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import {
  BookOpen,
  BookText,
  Briefcase,
  CloudSun,
  Coffee,
  GraduationCap,
  Hash,
  Handshake,
  HeartPulse,
  House,
  Landmark,
  Phone,
  ShoppingBag,
  TrainFront,
  Users,
  UtensilsCrossed,
  Clock,
  Dumbbell,
} from 'lucide-react-native'
import { radius, useTheme } from '@/lib/theme'
import { matchTopicGlyph, topicGlyphColors, type GlyphKey } from '@/lib/topicGlyph'
import type { SkillNode } from '@/lib/skillTreeApi'

const GLYPH_ICON: Record<GlyphKey, LucideIcon> = {
  cafe: Coffee,
  food: UtensilsCrossed,
  travel: TrainFront,
  greeting: Handshake,
  family: Users,
  time: Clock,
  numbers: Hash,
  shopping: ShoppingBag,
  home: House,
  work: Briefcase,
  health: HeartPulse,
  culture: Landmark,
  weather: CloudSun,
  communication: Phone,
  hobby: Dumbbell,
  exam: GraduationCap,
  grammar: BookText,
  default: BookOpen,
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
  const Glyph = GLYPH_ICON[key]

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
      <Glyph size={Math.round(size * 0.52)} color={fg} strokeWidth={2} />
    </View>
  )
}
