// Logo + chữ thương hiệu ở đầu màn Đăng nhập (mẫu v3.4 `login`: `data-logo` + `.wordmark`):
// "my" nét thường, "Deutsch" đậm, "Flow" đậm và luôn đỏ. Logo D lấy nguyên BrandMark, không vẽ lại.

import { View } from 'react-native'
import { fonts, space } from '@/lib/theme'
import { BrandMark, ThemedText } from '@/components/ui'

export function AuthWordmark() {
  const bold = { fontFamily: fonts.bodyBold }
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="myDeutschFlow"
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] + 2 }}
    >
      <BrandMark size={34} />
      <ThemedText variant="bodyLg" style={{ fontFamily: fonts.bodyRegular, letterSpacing: -0.4 }}>
        my
        <ThemedText variant="bodyLg" style={bold}>
          Deutsch
        </ThemedText>
        <ThemedText variant="bodyLg" color="brand" style={bold}>
          Flow
        </ThemedText>
      </ThemedText>
    </View>
  )
}
