import { GaGlyphMark } from './GaGlyphMark'
import { GaIcon } from './GaIcon'
import type { GlyphName } from '@/lib/galerieGlyphs'

/**
 * Icon của một mục điều hướng: glyph Galerie nếu `nav.ts` khai `glyph`, còn lại rơi về Lucide. Admin
 * và trung tâm chưa khai vì tên icon ở đó mang nghĩa khác (`school` là Học viên, không phải Luyện thi).
 */
export function GaNavIcon({
  icon,
  glyph,
  size,
  className,
}: {
  icon: string
  glyph?: GlyphName
  size: number
  className?: string
}) {
  return glyph
    ? <GaGlyphMark name={glyph} size={size} draw="hover" className={className} />
    : <GaIcon name={icon} size={size} className={className} />
}
