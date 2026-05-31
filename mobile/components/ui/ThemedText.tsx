// Typed text primitive. `variant` selects the role-based type scale; `color`
// selects a semantic text role. Both resolve against the active theme.

import { Text, type TextProps, type TextStyle } from 'react-native'
import { type TypeVariant, type, useTheme } from '@/lib/theme'

type ColorRole =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'faint'
  | 'accent'
  | 'success'
  | 'danger'
  | 'info'
  | 'onAccent'

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
    success: theme.colors.success,
    danger: theme.colors.danger,
    info: theme.colors.info,
    onAccent: theme.colors.onAccent,
  }

  return (
    <Text
      style={[type[variant], { color: colorMap[color], textAlign: align }, style]}
      {...rest}
    />
  )
}
