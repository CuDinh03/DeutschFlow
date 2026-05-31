// Shimmer placeholder. Loading should look like the content that's coming, not
// a generic spinner — compose these to match the real layout.

import { MotiView } from 'moti'
import { type DimensionValue, type ViewStyle, type StyleProp } from 'react-native'
import { radius as radiusScale, useTheme } from '@/lib/theme'

interface SkeletonProps {
  width?: DimensionValue
  height?: number
  radius?: keyof typeof radiusScale
  style?: StyleProp<ViewStyle>
}

export function Skeleton({ width = '100%', height = 16, radius = 'md', style }: SkeletonProps) {
  const theme = useTheme()

  return (
    <MotiView
      from={{ backgroundColor: theme.colors.skeletonBase }}
      animate={{ backgroundColor: theme.colors.skeletonHighlight }}
      transition={{ type: 'timing', duration: 800, loop: true, repeatReverse: true }}
      style={[{ width, height, borderRadius: radiusScale[radius] }, style]}
    />
  )
}
