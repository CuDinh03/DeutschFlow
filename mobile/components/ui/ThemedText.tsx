// Typed text primitive. `variant` selects the role-based type scale; `color`
// selects a semantic text role. Both resolve against the active theme.

import { Text, type TextProps, type TextStyle } from 'react-native'
import { type TypeVariant, maxFontScale, type, useTheme } from '@/lib/theme'

type ColorRole =
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
  | 'onInk'

interface ThemedTextProps extends TextProps {
  variant?: TypeVariant
  color?: ColorRole
  align?: TextStyle['textAlign']
}

export function ThemedText({
  variant = 'body',
  color = 'primary',
  align,
  style,
  ...rest
}: ThemedTextProps) {
  const theme = useTheme()

  const colorMap: Record<ColorRole, string> = {
    primary: theme.colors.textPrimary,
    secondary: theme.colors.textSecondary,
    muted: theme.colors.textMuted,
    faint: theme.colors.textFaint,
    accent: theme.colors.accentText,
    brand: theme.colors.brand,
    success: theme.colors.success,
    danger: theme.colors.danger,
    info: theme.colors.info,
    onAccent: theme.colors.onAccent,
    onInk: theme.colors.onInk,
  }

  return (
    <Text
      // Dynamic Type cap so large font settings don't break the editorial layout.
      // Placed before {...rest} so a caller can still override per-instance.
      maxFontSizeMultiplier={maxFontScale[variant]}
      style={[type[variant], { color: colorMap[color], textAlign: align }, style]}
      {...rest}
    />
  )
}
