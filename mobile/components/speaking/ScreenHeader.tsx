import { View, Pressable } from 'react-native'
import { X } from 'lucide-react-native'
import { space, useTheme } from '@/lib/theme'
import { ThemedText, Icon } from '@/components/ui'

export function ScreenHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const { colors } = useTheme()
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[2],
        paddingHorizontal: space[5],
        paddingVertical: space[3],
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Pressable hitSlop={8} onPress={onClose}>
        <Icon icon={X} size={22} color="muted" />
      </Pressable>
      <ThemedText variant="bodyStrong">{title}</ThemedText>
    </View>
  )
}
