// Icon-only pressable button. The shared primitive for the dozens of bare
// `<Pressable>` icon tap targets scattered across the app (mic, send, close,
// notifications bell, etc.). `accessibilityLabel` is REQUIRED at the type level
// so an unlabeled icon button becomes a TypeScript error rather than a silent
// VoiceOver/TalkBack failure.

import type { LucideIcon } from 'lucide-react-native'
import { Pressable, type StyleProp, type ViewStyle } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useTheme } from '@/lib/theme'
import { Icon } from './Icon'
import { GaGlyph } from './GaGlyph'
import type { GlyphName } from '@/lib/galerieGlyphs'
import { iconHitSlop } from '@/lib/touchTarget'

type IconColorRole =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'faint'
  | 'accent'
  | 'brand'
  | 'success'
  | 'danger'
  | 'info'
  | 'onAccent'

interface IconButtonProps {
  /** Icon Lucide (điều khiển: đóng, gửi…). Biểu tượng nhận diện (mic Speaking…) dùng `glyph`. */
  icon?: LucideIcon
  glyph?: GlyphName
  /** REQUIRED — assistive-tech announcement; e.g. "Đóng", "Gửi câu trả lời". */
  accessibilityLabel: string
  /** Optional hint announced after the label. */
  accessibilityHint?: string
  onPress: () => void
  color?: IconColorRole
  size?: number
  disabled?: boolean
  /** Vùng chạm mở rộng (pt). Mặc định đủ để icon `size` đạt tối thiểu 44pt của iOS. */
  hitSlop?: number
  style?: StyleProp<ViewStyle>
}

export function IconButton({
  icon,
  glyph,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  color = 'muted',
  size = 22,
  disabled = false,
  hitSlop,
  style,
}: IconButtonProps) {
  // 22pt + 8 mỗi phía chỉ được 38pt; tính theo cỡ icon để luôn ≥ 44pt.
  const slop = hitSlop ?? iconHitSlop(size)
  useTheme() // ensure rerender on theme change so Icon picks up the new color
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={slop}
      onPress={() => {
        if (disabled) return
        void Haptics.selectionAsync()
        onPress()
      }}
      style={({ pressed }) => [
        { opacity: pressed || disabled ? 0.5 : 1 },
        style,
      ]}
    >
      {glyph ? (
        <GaGlyph name={glyph} size={size} ink={color} gold={color === 'onAccent' ? 'ink' : 'accent'} />
      ) : icon ? (
        <Icon icon={icon} size={size} color={color} />
      ) : null}
    </Pressable>
  )
}
