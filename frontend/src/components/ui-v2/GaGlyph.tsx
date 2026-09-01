import * as React from 'react'
import { cn } from '@/lib/utils'
import { GaIcon } from './GaIcon'
import { iconNameForEmoji } from './emojiIconMap'

/**
 * GaGlyph — ô icon vuông bo góc, dùng thay cho emoji đứng một mình làm "biểu tượng chủ đề".
 *
 * Có hai lối vào vì nguồn dữ liệu khác nhau:
 *   · `name`  — biết trước tên icon (JSX tự viết).
 *   · `emoji` — chỉ có emoji do backend trả (`skill_tree_nodes.emoji`), dịch qua `emojiIconMap`.
 * `name` thắng `emoji` khi truyền cả hai. Không có cái nào thì rơi về `menu_book` chứ không phải
 * vòng tròn rỗng — một ô trống giữa các ô có icon trông như lỗi tải.
 *
 * Mặc định là trang trí (`aria-hidden` do GaIcon lo): tiêu đề luôn nằm ngay cạnh ở dạng chữ, nên
 * đọc thêm tên icon chỉ làm screen reader lặp. Truyền `title` khi ô icon là thông tin DUY NHẤT.
 */
export type GaGlyphSize = 'sm' | 'md' | 'lg'
export type GaGlyphTone = 'accent' | 'neutral' | 'ink' | 'green' | 'plain'

export interface GaGlyphProps {
  emoji?: string | null
  name?: string
  size?: GaGlyphSize
  tone?: GaGlyphTone
  title?: string
  className?: string
}

const BOX: Record<GaGlyphSize, string> = {
  sm: 'h-6 w-6',
  md: 'h-9 w-9',
  lg: 'h-12 w-12',
}

const GLYPH: Record<GaGlyphSize, number> = { sm: 14, md: 18, lg: 24 }

const TONE: Record<GaGlyphTone, string> = {
  accent: 'bg-ga-accent-soft text-ga-accent',
  neutral: 'bg-ga-side-active text-ga-subtle',
  ink: 'bg-ga-ink text-ga-bg',
  green: 'bg-ga-green-soft text-ga-green',
  plain: 'text-ga-muted',
}

export function GaGlyph({
  emoji,
  name,
  size = 'md',
  tone = 'accent',
  title,
  className,
}: GaGlyphProps) {
  const iconName = name ?? iconNameForEmoji(emoji)
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-ga',
        BOX[size],
        TONE[tone],
        className,
      )}
    >
      <GaIcon name={iconName} size={GLYPH[size]} title={title} />
    </span>
  )
}
