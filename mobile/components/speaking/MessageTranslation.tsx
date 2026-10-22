import { useState } from 'react'
import { ActivityIndicator, Pressable, View } from 'react-native'
import { Languages } from 'lucide-react-native'
import { space, useTheme } from '@/lib/theme'
import { ThemedText } from '@/components/ui'
import { speakingApi } from '@/lib/speakingApi'

/**
 * Nút "Dịch" dưới câu của trợ lý (K4 A+B+E, 22/10/2026). Mặc định ẩn để người học tự nghe hiểu
 * trước; bấm lần đầu mới gọi backend (backend lưu lại), bấm tiếp chỉ ẩn/hiện. App chỉ có tiếng Việt
 * nên luôn dịch sang tiếng Việt.
 */
export function MessageTranslation({ sessionId, messageId }: { sessionId: number; messageId: number }) {
  const { colors } = useTheme()
  const [text, setText] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')

  const toggle = async () => {
    if (text) {
      setOpen((v) => !v)
      return
    }
    setState('loading')
    try {
      setText(await speakingApi.translateMessage(sessionId, messageId, 'vi'))
      setOpen(true)
      setState('idle')
    } catch {
      setState('error')
    }
  }

  const label = state === 'error' ? 'Chưa dịch được · Chạm để thử lại' : open ? 'Ẩn bản dịch' : 'Dịch'

  return (
    <View style={{ maxWidth: '92%', gap: space[1] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open, busy: state === 'loading' }}
        disabled={state === 'loading'}
        onPress={() => void toggle()}
        hitSlop={8}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space[1], paddingVertical: space[1] }}
      >
        {state === 'loading' ? (
          <ActivityIndicator size="small" color={colors.textSecondary} />
        ) : (
          <Languages size={14} color={colors.textSecondary} />
        )}
        <ThemedText variant="caption" color={state === 'error' ? 'danger' : 'muted'}>
          {label}
        </ThemedText>
      </Pressable>
      {open && text ? (
        <ThemedText variant="caption" color="muted">
          {text}
        </ThemedText>
      ) : null}
    </View>
  )
}
