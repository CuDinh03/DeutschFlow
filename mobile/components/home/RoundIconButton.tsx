// Nút tròn 44pt ở thanh đầu màn (giao diện v3.4, `.iconbtn` của mẫu): nền thẻ, viền mảnh, có thể kèm
// số chưa đọc. Lucide cho điều khiển (dấu hỏi Hướng dẫn); glyph Galerie cho biểu tượng nhận diện
// (Tin nhắn, Thông báo) như trước.

import type { LucideIcon } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import type { GlyphName } from '@/lib/galerieGlyphs'
import { radius, useTheme } from '@/lib/theme'
import { GaGlyph, Icon, ThemedText } from '@/components/ui'

const SIZE = 44

export function RoundIconButton({
  icon,
  glyph,
  label,
  hint,
  badge = 0,
  onPress,
}: {
  icon?: LucideIcon
  glyph?: GlyphName
  label: string
  hint?: string
  badge?: number
  onPress: () => void
}) {
  const c = useTheme().colors
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={() => {
        void Haptics.selectionAsync()
        onPress()
      }}
      style={({ pressed }) => ({
        width: SIZE,
        height: SIZE,
        borderRadius: radius.full,
        backgroundColor: pressed ? c.surfaceSunken : c.surface,
        borderWidth: 1,
        borderColor: c.border,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      {glyph ? <GaGlyph name={glyph} size={20} ink="secondary" /> : icon ? <Icon icon={icon} size={20} color="primary" /> : null}
      {badge > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: -3,
            right: -3,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: radius.full,
            backgroundColor: c.danger,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: c.bg,
          }}
        >
          <ThemedText variant="caption" style={{ color: c.onBrand, fontSize: 10 }}>
            {badge > 9 ? '9+' : String(badge)}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  )
}
