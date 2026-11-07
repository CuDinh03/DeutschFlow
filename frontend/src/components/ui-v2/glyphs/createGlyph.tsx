import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Glyph tự vẽ cho những chỗ Lucide 0.487 không có hình đúng nghĩa. Cùng ngữ pháp với Lucide để đứng
 * cạnh nhau không lộ: lưới 24×24, hình trong 2–22, nét 1.9, `stroke="currentColor"`, đầu và góc nét
 * bo tròn, không tô mảng. Dùng y như một icon Lucide (`<SpeakAi size={18} />`, `<GaGlyph icon={SpeakAi} />`).
 *
 * Thêm glyph mới: vẽ bằng path/circle/rect trong `./index.tsx`, đặt tên PascalCase theo NGHĨA (không
 * theo hình), thêm vào `GA_LINE_GLYPHS` để test kiểm luật và bảng soi hình nhận ra.
 */
export interface LineGlyphProps extends Omit<React.SVGProps<SVGSVGElement>, 'ref'> {
  size?: number | string
  strokeWidth?: number | string
  title?: string
}

export type LineGlyph = React.ForwardRefExoticComponent<LineGlyphProps & React.RefAttributes<SVGSVGElement>> & {
  glyphName: string
}

export function createGlyph(name: string, children: React.ReactNode): LineGlyph {
  const Cmp = React.forwardRef<SVGSVGElement, LineGlyphProps>(function Glyph(
    { size = 24, strokeWidth = 1.9, title, className, ...rest },
    ref,
  ) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        role={title ? 'img' : undefined}
        aria-label={title}
        aria-hidden={title ? undefined : true}
        data-glyph={name}
        className={cn('ga-line-glyph shrink-0', className)}
        {...rest}
      >
        {children}
      </svg>
    )
  }) as LineGlyph
  Cmp.displayName = name
  Cmp.glyphName = name
  return Cmp
}
