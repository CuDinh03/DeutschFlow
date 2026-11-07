import * as React from 'react'
import { createGlyph, type LineGlyph } from './createGlyph'

export { createGlyph } from './createGlyph'
export type { LineGlyph, LineGlyphProps } from './createGlyph'

/**
 * Bộ glyph nét của web — chỉ những hình Lucide 0.487 KHÔNG có đúng nghĩa. Luật: `createGlyph.tsx`.
 * Ghi chỗ dùng ở cột cuối để biết glyph nào còn sống.
 */

/** Người nói AI: bong bóng thoại chứa sóng âm. Lucide chỉ có bong bóng trơn hoặc micro.
 *  Dùng ở: đầu tóm tắt buổi nói, avatar lượt AI trong lịch sử luyện nói. */
export const SpeakAi = createGlyph(
  'SpeakAi',
  <>
    <path d="M6 4h12a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-6l-4.5 3.5V17H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z" />
    <path d="M8.5 9.5v2" />
    <path d="M12 7.5v6" />
    <path d="M15.5 9.5v2" />
  </>,
)

/** Nụ (bài đã mở, chưa học) trên cây lộ trình — vẽ lại motif `rtBud` của SkillTreeCanvas bằng nét.
 *  Lucide không có nụ hoa. Dùng ở: chú giải cây lộ trình. */
export const TreeBud = createGlyph(
  'TreeBud',
  <>
    <path d="M12 21v-7" />
    <path d="M12 14c-2.9 0-4.8-2.3-4.8-5.1 0-2.6 2-4.9 4.8-5.9 2.8 1 4.8 3.3 4.8 5.9 0 2.8-1.9 5.1-4.8 5.1Z" />
    <path d="M12 14V8.5" />
    <path d="M12 18.5c-2.2 0-3.9-1-4.6-2.9 2.1-.3 3.8.7 4.6 2.9Z" />
  </>,
)

/** Chấm khoá (bài chưa mở) trên cây lộ trình — motif `rtNub`: hạt tròn có cuống xoắn.
 *  Dùng ở: chú giải cây lộ trình. */
export const TreeNub = createGlyph(
  'TreeNub',
  <>
    <circle cx="12" cy="14" r="5.5" />
    <path d="M12 8.5c0-2.6 2.7-3.4 3.9-2 .7.8.3 1.9-.9 2" />
  </>,
)

/** Danh sách đầy đủ — test kiểm luật hình học và bảng soi hình đọc từ đây. */
export const GA_LINE_GLYPHS: Record<string, LineGlyph> = { SpeakAi, TreeBud, TreeNub }
