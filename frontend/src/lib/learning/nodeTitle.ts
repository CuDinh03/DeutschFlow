'use client'

import { useLocale } from 'next-intl'

/**
 * Tiêu đề chặng lộ trình theo ngôn ngữ đang xem.
 *
 * Một node chỉ mang HAI bản chữ: `title` là tiếng Đức (tên chương trong giáo trình) và `subtitle`
 * là bản dịch — hôm nay luôn là tiếng Việt. Không có bản tiếng Anh.
 *
 * Trước đây mọi màn đều cứng `subtitle || title`, nên người chọn giao diện tiếng Đức — và cả tiếng
 * Anh — đều thấy tên chương tiếng Việt làm tiêu đề chính, tiếng Đức bị đẩy xuống dòng phụ in nghiêng.
 *
 * Owner chốt 10/09/2026: chỉ bản `vi` mới lấy tiếng Việt làm tiêu đề (kèm tiếng Đức làm dòng ngữ
 * cảnh). `de` và `en` lấy thẳng tên tiếng Đức, không dòng phụ — người xem tiếng Anh thà đọc đúng tên
 * chương mình đang học còn hơn đọc một thứ tiếng mình không biết. Khi giáo trình có `title_en` thật
 * thì mở rộng ở ĐÂY, không rải lại ra từng màn (ca AC-I18N-17).
 */

/** Chỉ cần hai trường chữ — nhận được cả `RoadmapNode` lẫn DTO thô của `/roadmap/me`. */
export interface TitledNode {
  title?: string | null
  subtitle?: string | null
}

export interface NodeTitles {
  /** Dòng tiêu đề chính. */
  primary: string
  /** Dòng ngữ cảnh dưới tiêu đề, `null` khi không có gì để thêm. */
  secondary: string | null
}

export function nodeTitles(node: TitledNode, locale: string): NodeTitles {
  const german = node.title ?? ''
  const translated = node.subtitle ?? ''
  if (!translated) return { primary: german, secondary: null }
  if (!german) return { primary: translated, secondary: null }
  return locale === 'vi'
    ? { primary: translated, secondary: german }
    : { primary: german, secondary: null }
}

/** Bản hook: đọc locale một lần cho cả danh sách node. */
export function useNodeTitles(): (node: TitledNode) => NodeTitles {
  const locale = useLocale()
  return (node) => nodeTitles(node, locale)
}
