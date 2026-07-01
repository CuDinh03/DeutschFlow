// SelectableRow — full-width selectable option row for multiple-choice / radio
// lists (exam-attempt, node-practice). Centralises role + label + selected /
// disabled state so every option exposes consistent a11y. Presentation stays
// with the caller via `style` / `children`, keeping each screen's own visual.
//
// Use role="radio" for single-select radio groups (announces "radio button"),
// role="button" (default) for tap-to-select multiple-choice rows.

import type { ReactNode } from 'react'
import { Pressable, type StyleProp, type ViewStyle } from 'react-native'

interface SelectableRowProps {
  /** Announced to VoiceOver/TalkBack. */
  label: string
  /** Selected state → accessibilityState.selected. */
  selected?: boolean
  disabled?: boolean
  role?: 'button' | 'radio'
  onPress: () => void
  style?: StyleProp<ViewStyle>
  children: ReactNode
}

export function SelectableRow({
  label,
  selected,
  disabled = false,
  role = 'button',
  onPress,
  style,
  children,
}: SelectableRowProps) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={style}
    >
      {children}
    </Pressable>
  )
}
