// Quầng vàng góc trên phải của màn Đăng nhập (`.aura` trong mẫu v3.4 `login`): một vệt tỏa từ góc
// (bán kính ~280pt như `radial-gradient` 66% của mẫu),
// thuần trang trí. Mẫu cho quầng trôi nhẹ; ở đây giữ đứng yên để màn đầu tiên không có chuyển động lặp
// vô hạn (WCAG 2.2.2) và không tốn khung hình lúc bàn phím mở.

import { View } from 'react-native'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import { useTheme } from '@/lib/theme'

const AURA_SIZE = 300

export function AuthAura() {
  const c = useTheme().colors
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: 0, right: 0, width: AURA_SIZE, height: AURA_SIZE }}
    >
      <Svg width={AURA_SIZE} height={AURA_SIZE}>
        <Defs>
          <RadialGradient id="authAura" cx="100%" cy="0%" r="94%" fx="100%" fy="0%">
            <Stop offset="0" stopColor={c.accent} stopOpacity={0.32} />
            <Stop offset="1" stopColor={c.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={AURA_SIZE} height={AURA_SIZE} fill="url(#authAura)" />
      </Svg>
    </View>
  )
}
