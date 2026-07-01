// SelectableChip — Pressable for filter / toggle chips. Centralises the a11y
// triple (role=button + label + selected state) and a default hitSlop that keeps
// short chips at the iOS 44pt touch target. Presentation stays with the caller
// via `style` / `children`, so each screen keeps its own editorial v2 visual.
//
// Pass `selected` for toggle chips (filters, level pickers); omit it for plain
// action chips (e.g. an export button) so VoiceOver doesn't announce "not selected".

import type { ReactNode } from 'react'
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'

interface SelectableChipProps {
  /** Announced to VoiceOver/TalkBack. */
  label: string
  /** Toggle state → accessibilityState.selected. Omit for non-toggle action chips. */
  selected?: boolean
  disabled?: boolean
  onPress: () => void
  /** Defaults to a 44pt-safe slop for short chips; pass a number/object to override. */
  hitSlop?: PressableProps['hitSlop']
  style?: StyleProp<ViewStyle>
  children: ReactNode
}

const DEFAULT_HIT_SLOP = { top: 8, bottom: 8, left: 4, right: 4 } as const

export function SelectableChip({
  label,
  selected,
  disabled = false,
  onPress,
  hitSlop = DEFAULT_HIT_SLOP,
  style,
  children,
}: SelectableChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      hitSlop={hitSlop}
      disabled={disabled}
      onPress={onPress}
      style={style}
    >
      {children}
    </Pressable>
  )
}
