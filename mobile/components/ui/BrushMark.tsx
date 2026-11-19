import { View } from 'react-native'
import { useTheme } from '@/lib/theme'
import { ThemedText } from './ThemedText'

/** Chữ có vệt bút dạ vàng phía dưới, như `.mark` của mẫu v3.4 (tiêu đề lớn các màn). */
export function BrushMark({ children }: { children: string }) {
  const c = useTheme().colors
  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: -2, right: -2, bottom: 4, height: '42%', borderRadius: 6, backgroundColor: c.accent, transform: [{ rotate: '-1deg' }] }}
      />
      <ThemedText variant="display">{children}</ThemedText>
    </View>
  )
}
