import { useEffect, useState } from 'react'
import { Modal, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { radius, space, useTheme } from '@/lib/theme'
import { Button, GaGlyph, ThemedText } from '@/components/ui'
import {
  minorAudioCopy,
  registerMinorAudioBlockedPresenter,
  type MinorAudioBlocked,
} from '@/lib/minorAudio'
import { captureEvent } from '@/lib/analytics'

// Sheet giải thích 403 MINOR_AUDIO_BLOCKED (DEC-22, D8 10/09): phần ghi âm bị chặn vì chưa xác
// định tuổi / chưa có (hoặc đã rút) đồng ý của người giám hộ. Học viên 16–17 trong pilot chưa có
// phiếu đồng ý sẽ gặp nó ngay buổi đầu — nên nó phải nói rõ VIỆC CẦN LÀM và AI làm, chứ không phải
// "bạn không có quyền", và tuyệt đối không mời nâng gói (nâng gói không mở được cổng này).
//
// Mount MỘT lần ở root layout (<MinorAudioBlockedHost/>, cạnh <AiConsentHost/>). Màn hình không
// render sheet này — chúng gọi `presentMinorAudioBlocked(error)` (lib/minorAudio.ts) trong catch.
// Cùng khuôn với AiConsentSheet: Modal trong suốt, tấm đáy bo góc, biểu tượng nhận diện là GaGlyph
// (Lucide chỉ cho điều khiển), không emoji.

interface SheetState {
  info: MinorAudioBlocked
  contact: boolean
}

export function MinorAudioBlockedHost() {
  const c = useTheme().colors
  const [state, setState] = useState<SheetState | null>(null)

  useEffect(() => {
    registerMinorAudioBlockedPresenter((info, options) => {
      captureEvent('minor_audio_blocked_shown', { reason: info.reason })
      setState({ info, contact: options.contact })
    })
    return () => registerMinorAudioBlockedPresenter(null)
  }, [])

  const close = () => setState(null)
  // Lối "liên hệ trung tâm" = màn lớp của học viên (giáo viên chủ nhiệm, kênh lớp). Đóng sheet
  // TRƯỚC rồi mới điều hướng — Modal ở root mà còn mở thì màn đích nằm dưới lớp phủ.
  const contact = () => {
    setState(null)
    router.push('/(student)/classes')
  }

  return (
    <Modal visible={state !== null} transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: c.bg,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingHorizontal: space[6],
            paddingTop: space[6],
            paddingBottom: space[8],
            maxHeight: '88%',
          }}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {state ? (
              <MinorAudioBlockedContent
                info={state.info}
                contact={state.contact}
                onClose={close}
                onContact={contact}
              />
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

export interface MinorAudioBlockedContentProps {
  info: MinorAudioBlocked
  /** Hiện nút "Liên hệ trung tâm" (tắt ở màn không được rời — onboarding). */
  contact: boolean
  onClose: () => void
  onContact: () => void
}

/**
 * Phần nội dung thuần (không state) — tách để test dựng được cây phần tử mà không cần renderer:
 * tiêu đề theo `reason`, nội dung ưu tiên `detail` của server, ghi chú "nâng gói không mở được".
 */
export function MinorAudioBlockedContent({ info, contact, onClose, onContact }: MinorAudioBlockedContentProps) {
  const c = useTheme().colors
  const copy = minorAudioCopy(info)

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            backgroundColor: c.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <GaGlyph name="khoa" size={22} accessibilityLabel={copy.eyebrow} />
        </View>
        <ThemedText variant="label" color="secondary" style={{ flex: 1 }}>
          {copy.eyebrow}
        </ThemedText>
      </View>

      <ThemedText variant="titleLg" style={{ marginTop: space[4] }}>
        {copy.title}
      </ThemedText>
      <ThemedText variant="body" color="secondary" style={{ marginTop: space[2], lineHeight: 22 }}>
        {copy.body}
      </ThemedText>

      <View
        style={{
          marginTop: space[4],
          padding: space[3],
          borderRadius: radius.md,
          backgroundColor: c.surfaceSunken,
          borderLeftWidth: 3,
          borderLeftColor: c.accent,
        }}
      >
        <ThemedText variant="caption" color="secondary" style={{ lineHeight: 18 }}>
          {copy.note}
        </ThemedText>
      </View>

      <View style={{ gap: space[3], marginTop: space[6] }}>
        <Button label="Đã hiểu" onPress={onClose} />
        {contact ? <Button label="Liên hệ trung tâm" variant="secondary" onPress={onContact} /> : null}
      </View>
    </View>
  )
}
