import { Bug, MessageSquarePlus, MousePointerClick, ThumbsUp } from 'lucide-react'
import type { GaGlyphTone } from '@/components/ui-v2'
import type { FeedbackStatus, FeedbackType } from '@/lib/feedbackApi'

/**
 * Hình và màu của góp ý, dùng chung cho trang Góp ý và hộp góp ý admin. Cố ý không có chuỗi dịch: hai
 * khu dùng hai catalog khác nhau (`v2.account.feedback`, `v2.adminOps.feedback`).
 */
export const TYPE_GLYPH: Record<FeedbackType, { icon: typeof Bug; tone: GaGlyphTone }> = {
  BUG: { icon: Bug, tone: 'red' },
  IDEA: { icon: MessageSquarePlus, tone: 'navy' },
  USABILITY: { icon: MousePointerClick, tone: 'orange' },
  GENERAL: { icon: ThumbsUp, tone: 'green' },
}

export const STATUS_PILL: Record<FeedbackStatus, string> = {
  NEW: 'bg-ga-blue-soft text-ga-blue',
  READ: 'bg-ga-side-active text-ga-muted',
  IN_PROGRESS: 'bg-ga-warning-soft text-ga-warning',
  SHIPPED: 'bg-ga-green-soft text-ga-green',
  DECLINED: 'bg-ga-side-active text-ga-ink',
}

/** Nhãn trạng thái người gửi thấy (BR-06): Báo lỗi đã xử lý là "Đã sửa", không phải "Đã ra mắt". */
export function statusKey(status: FeedbackStatus, type: FeedbackType): string {
  return status === 'SHIPPED' && type === 'BUG' ? 'SHIPPED_BUG' : status
}
