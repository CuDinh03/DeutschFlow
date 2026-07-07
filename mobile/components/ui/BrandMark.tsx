// Static MyDeutschFlow 'D' logo mark (matches the splash + app icon geometry).
// Outline follows the theme text colour so it reads in light + dark; the gold
// square and red play-triangle are brand-locked.

import Svg, { Path, Rect } from 'react-native-svg'
import { useTheme } from '@/lib/theme'

const D_PATH = 'M20 18 L20 82 L52 82 L74 62 L74 38 L52 18 Z'
const GOLD = '#FFCD00'
const RED = '#DA291C'

interface BrandMarkProps {
  size?: number
}

export function BrandMark({ size = 64 }: BrandMarkProps) {
  const theme = useTheme()
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d={D_PATH}
        stroke={theme.colors.textPrimary}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="miter"
        fill="none"
      />
      <Path d="M52 38 L74 50 L52 62 Z" fill={RED} />
      <Rect x={24} y={45} width={9} height={9} fill={GOLD} />
    </Svg>
  )
}
