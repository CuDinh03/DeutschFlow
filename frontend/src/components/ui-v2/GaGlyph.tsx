import * as React from 'react'
import { cn } from '@/lib/utils'
import { GaIcon } from './GaIcon'
import { iconNameForEmoji } from './emojiIconMap'

/**
 * GaGlyph — ô icon NHẬN DIỆN của web: vuông bo `rounded-ga`, nền mềm, một icon nét 1.9 ở giữa.
 * Mọi icon đứng thay cho một phần/tính năng/kỹ năng/thẻ số liệu/trạng thái trống đi qua ô này, nên
 * cùng cỡ và cùng màu ở mọi khu (học viên, giáo viên, trung tâm, admin). Icon điều khiển (mũi tên,
 * đóng, tick trong nút…) KHÔNG bọc ô — dùng Lucide trần.
 *
 * Ba lối vào, theo thứ tự ưu tiên:
 *   · `icon`  — component icon: Lucide (`BookOpen`) hoặc glyph tự vẽ trong `./glyphs` (`SpeakAi`).
 *   · `name`  — tên trong bảng `GaIcon` (dữ liệu khai bằng chuỗi, ví dụ `nav.ts`, thông báo).
 *   · `emoji` — chỉ có emoji do backend trả (`skill_tree_nodes.emoji`), dịch qua `emojiIconMap`.
 * Không có cái nào thì rơi về `menu_book`: một ô trống giữa các ô có icon trông như lỗi tải.
 *
 * Tông (chỉ token `ga-*`):
 *   navy   — mặc định: nền `ga-navy-soft`, icon `ga-navy`.
 *   plain  — trung tính / đang khoá / phụ: nền `ga-side-active`, icon `ga-muted`.
 *   yellow — điểm nhấn duy nhất trên màn (việc hôm nay, gợi ý chính): nền `ga-yellow`, icon `ga-ink`.
 *   ink    — đang chọn: nền `ga-ink`, icon `ga-card`.
 *   green / red — trạng thái đạt / lỗi.
 *   orange — cảnh báo không phải lỗi (lời mời hết hạn): khác hẳn đỏ "không hợp lệ".
 *   accent — theo vai trò (tím giáo viên, xanh ngọc trung tâm…), icon luôn `ga-ink` để đủ tương phản
 *            cả với nền vàng nhạt của học viên.
 *
 * Cỡ: sm 28px (icon 15) · md 36px (icon 18) · lg 48px (icon 24).
 *
 * Mặc định là trang trí (`aria-hidden`): chữ cạnh bên đã nói đủ. Truyền `title` khi ô icon là thông
 * tin DUY NHẤT.
 */
export type GaGlyphSize = 'sm' | 'md' | 'lg'
export type GaGlyphTone = 'navy' | 'plain' | 'yellow' | 'ink' | 'green' | 'red' | 'orange' | 'accent'

/** Hình dạng chung của Lucide và glyph tự vẽ (`./glyphs`). */
export type GaGlyphIcon = React.ComponentType<{
  size?: number | string
  strokeWidth?: number | string
  className?: string
  'aria-hidden'?: boolean | 'true' | 'false'
}>

export interface GaGlyphProps {
  icon?: GaGlyphIcon
  name?: string
  emoji?: string | null
  size?: GaGlyphSize
  tone?: GaGlyphTone
  title?: string
  className?: string
}

const BOX: Record<GaGlyphSize, string> = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-12 w-12',
}

export const GA_GLYPH_PX: Record<GaGlyphSize, number> = { sm: 15, md: 18, lg: 24 }

const TONE: Record<GaGlyphTone, string> = {
  navy: 'bg-ga-navy-soft text-ga-navy',
  plain: 'bg-ga-side-active text-ga-muted',
  yellow: 'bg-ga-yellow text-ga-ink',
  ink: 'bg-ga-ink text-ga-card',
  green: 'bg-ga-green-soft text-ga-green',
  red: 'bg-ga-red-soft text-ga-red',
  orange: 'bg-ga-orange-soft text-ga-orange',
  accent: 'bg-ga-accent-soft text-ga-ink',
}

export function GaGlyph({ icon: Icon, name, emoji, size = 'md', tone = 'navy', title, className }: GaGlyphProps) {
  const px = GA_GLYPH_PX[size]
  return (
    <span
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn('grid shrink-0 place-items-center rounded-ga', BOX[size], TONE[tone], className)}
    >
      {Icon ? (
        <Icon size={px} strokeWidth={1.9} aria-hidden />
      ) : (
        <GaIcon name={name ?? iconNameForEmoji(emoji)} size={px} />
      )}
    </span>
  )
}
