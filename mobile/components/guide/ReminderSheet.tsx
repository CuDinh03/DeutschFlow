// Sheet pre-permission nhắc học (onboarding v1 §7.2). KHÔNG xin quyền lúc mở
// app: sheet ngữ cảnh hỏi trước, user đồng ý mới gọi hộp thoại hệ thống — từ
// chối sheet không đốt lượt hỏi quyền OS, hỏi lại sau (cooldown ở caller).

import { Modal, Pressable, View } from 'react-native'
import { MotiView } from 'moti'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Bell } from 'lucide-react-native'
import { motion, radius, space, useTheme } from '@/lib/theme'
import { ThemedText, Button, Icon } from '@/components/ui'
import { REMINDER_HOUR } from '@/lib/studyReminder'

export function ReminderSheet({
  visible,
  dailyGoalMinutes,
  busy,
  onAccept,
  onDecline,
}: {
  visible: boolean
  dailyGoalMinutes: number | null
  /** Đang chờ hộp thoại quyền hệ thống — khoá nút tránh double-tap. */
  busy: boolean
  onAccept: () => void
  onDecline: () => void
}) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const goalCopy = dailyGoalMinutes ? `theo mục tiêu ${dailyGoalMinutes} phút/ngày của bạn` : 'chỉ vài phút mỗi ngày'

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onDecline}>
      <Pressable
        onPress={onDecline}
        style={{ flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' }}
      >
        <Pressable onPress={() => {}}>
          <MotiView
            from={{ translateY: 40, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            transition={{ type: 'spring', ...motion.spring.snappy }}
            style={{
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: radius['3xl'],
              borderTopRightRadius: radius['3xl'],
              paddingHorizontal: space[6],
              paddingTop: space[6],
              paddingBottom: insets.bottom + space[5],
              gap: space[4],
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: radius.xl,
                backgroundColor: theme.colors.accentSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon icon={Bell} size={26} color="accent" />
            </View>
            <View style={{ gap: space[2] }}>
              <ThemedText variant="titleLg">Giữ chuỗi bằng một lời nhắc nhẹ</ThemedText>
              <ThemedText variant="body" color="secondary">
                {`Mình nhắc bạn lúc ${REMINDER_HOUR}:00 mỗi tối để giữ chuỗi — ${goalCopy}. Chỉ 1 thông báo mỗi ngày, tắt được bất cứ lúc nào.`}
              </ThemedText>
            </View>
            <View style={{ gap: space[3] }}>
              <Button label="Bật nhắc học" onPress={onAccept} loading={busy} />
              <Button label="Để sau" variant="ghost" onPress={onDecline} disabled={busy} />
            </View>
          </MotiView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
