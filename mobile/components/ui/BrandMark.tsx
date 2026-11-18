// Logo D của myDeutschFlow — đúng hình học SVG chính thức của bộ nhận diện v3.4
// (docs/design/public-v3-assets/logo-mark-light.svg, viewBox 100): nét D mực dày 11, góc
// vuông (miter), ô vàng 13×13 và tam giác đỏ cố định màu. Nét D theo màu chữ chính của theme.
// Không tự vẽ lại logo: đổi hình phải lấy từ bộ nhận diện owner đưa.

import Svg, { Path, Polygon, Rect } from 'react-native-svg'
import { useTheme } from '@/lib/theme'

export const BRAND_D_PATH = 'M 16 13 L 55 13 L 84 37 L 84 63 L 55 87 L 16 87 Z'
const GOLD = '#FFC900'
const RED = '#E3261D'

interface BrandMarkProps {
  size?: number
}

export function BrandMark({ size = 64 }: BrandMarkProps) {
  const theme = useTheme()
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="myDeutschFlow">
      <Path d={BRAND_D_PATH} stroke={theme.colors.textPrimary} strokeWidth={11} strokeLinejoin="miter" fill="none" />
      <Rect x={27} y={43.5} width={13} height={13} rx={1.5} fill={GOLD} />
      <Polygon points="49,33 72,50 49,67" fill={RED} />
    </Svg>
  )
}
