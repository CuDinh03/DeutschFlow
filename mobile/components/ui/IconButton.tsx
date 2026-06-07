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
  icon: LucideIcon
  /** REQUIRED — assistive-tech announcement; e.g. "Đóng", "Gửi câu trả lời". */
  accessibilityLabel: string
  /** Optional hint announced after the label. */
  accessibilityHint?: string
  onPress: () => void
  color?: IconColorRole
  size?: number
  disabled?: boolean
  /** Expanded hit area in pt; defaults to 8 so a 22pt icon meets the 44pt iOS minimum. */
  hitSlop?: number
  style?: StyleProp<ViewStyle>
}

export function IconButton({
  icon,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  color = 'muted',
  size = 22,
  disabled = false,
  hitSlop = 8,
  style,
}: IconButtonProps) {
  useTheme() // ensure rerender on theme change so Icon picks up the new color
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={hitSlop}
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
      <Icon icon={icon} size={size} color={color} />
    </Pressable>
  )
}
