// Shared block/report UX flows (Alert-based) for the messaging surfaces, so the DM thread and the
// class channel present identical, Apple-1.2-compliant safety actions.

import { Alert } from 'react-native'
import { apiMessage } from './api'
import { moderationApi, type ReportContext, type ReportReason } from './moderationApi'

const REASONS: { key: ReportReason; label: string }[] = [
  { key: 'HARASSMENT', label: 'Quấy rối / bắt nạt' },
  { key: 'SEXUAL', label: 'Nội dung khiêu dâm' },
  { key: 'HATE', label: 'Thù ghét / phân biệt đối xử' },
  { key: 'SPAM', label: 'Spam / lừa đảo' },
  { key: 'OTHER', label: 'Khác' },
]

interface ReportTarget {
  context: ReportContext
  targetUserId?: number
  messageId?: number
  classMessageId?: number
  classId?: number
}

/** Prompt for a reason, then file the report. Shows a confirmation / error alert. */
export function reportFlow(target: ReportTarget, title = 'Báo cáo') {
  Alert.alert(title, 'Chọn lý do báo cáo. Chúng tôi sẽ xem xét và xử lý.', [
    ...REASONS.map((r) => ({
      text: r.label,
      onPress: () => {
        void moderationApi
          .report({ ...target, reason: r.key })
          .then(() =>
            Alert.alert('Đã gửi báo cáo', 'Cảm ơn bạn. Đội ngũ của chúng tôi sẽ xem xét.'),
          )
          .catch((e) => Alert.alert('Lỗi', apiMessage(e)))
      },
    })),
    { text: 'Hủy', style: 'cancel' as const },
  ])
}

/** Confirm, then block the user. Calls onBlocked on success (e.g. to refresh + go back). */
export function blockFlow(userId: number, name: string, onBlocked?: () => void) {
  Alert.alert(
    `Chặn ${name}?`,
    'Người này sẽ không thể nhắn tin cho bạn, và bạn sẽ không thấy nội dung của họ. Bạn có thể bỏ chặn trong Cài đặt → An toàn.',
    [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Chặn',
        style: 'destructive',
        onPress: () => {
          void moderationApi
            .block(userId)
            .then(() => {
              Alert.alert('Đã chặn', `Bạn đã chặn ${name}.`)
              onBlocked?.()
            })
            .catch((e) => Alert.alert('Lỗi', apiMessage(e)))
        },
      },
    ],
  )
}

/** The "⋮" menu shown from a conversation header: report user, block user. */
export function userSafetyMenu(userId: number, name: string, onBlocked?: () => void) {
  Alert.alert(name, undefined, [
    { text: 'Báo cáo người này', onPress: () => reportFlow({ context: 'USER', targetUserId: userId }) },
    { text: `Chặn ${name}`, style: 'destructive', onPress: () => blockFlow(userId, name, onBlocked) },
    { text: 'Hủy', style: 'cancel' },
  ])
}
