// Error state with retry. Distinct from EmptyState: something failed and the
// user can act on it. Message should be human, never a raw stack.

import { TriangleAlert } from 'lucide-react-native'
import { View } from 'react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Button } from './Button'
import { Icon } from './Icon'
import { ThemedText } from './ThemedText'

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
}

export function ErrorState({
  title = 'Đã có lỗi xảy ra',
  message = 'Không thể tải dữ liệu. Vui lòng thử lại.',
  onRetry,
}: ErrorStateProps) {
  const theme = useTheme()

  return (
    <View style={{ alignItems: 'center', paddingVertical: space[10], paddingHorizontal: space[6], gap: space[3] }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: radius['2xl'],
          backgroundColor: theme.colors.dangerSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon icon={TriangleAlert} size={28} color="danger" />
      </View>
      <ThemedText variant="title" align="center">
        {title}
      </ThemedText>
      <ThemedText variant="body" color="secondary" align="center">
        {message}
      </ThemedText>
      {onRetry ? (
        <Button label="Thử lại" onPress={onRetry} variant="secondary" fullWidth={false} style={{ marginTop: space[2] }} />
      ) : null}
    </View>
  )
}
