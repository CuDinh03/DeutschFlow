// Thin wrapper over lucide-react-native that maps semantic color roles to the
// active theme and applies a consistent default stroke weight.

import type { LucideIcon } from 'lucide-react-native'
import { useTheme } from '@/lib/theme'

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
  | 'onInk'

interface IconProps {
  icon: LucideIcon
  size?: number
  color?: IconColorRole
  fill?: boolean
  strokeWidth?: number
}

export function Icon({
  icon: LucideComponent,
  size = 20,
  color = 'primary',
  fill = false,
  strokeWidth = 2,
}: IconProps) {
  const theme = useTheme()

  const colorMap: Record<IconColorRole, string> = {
    primary: theme.colors.textPrimary,
    secondary: theme.colors.textSecondary,
    muted: theme.colors.textMuted,
    faint: theme.colors.textFaint,
    accent: theme.colors.accent,
    brand: theme.colors.brand,
    success: theme.colors.success,
    danger: theme.colors.danger,
    info: theme.colors.info,
    onAccent: theme.colors.onAccent,
    onInk: theme.colors.onInk,
  }

  const resolved = colorMap[color]
  return (
    <LucideComponent
      size={size}
      color={resolved}
      strokeWidth={strokeWidth}
      fill={fill ? resolved : 'transparent'}
    />
  )
}
