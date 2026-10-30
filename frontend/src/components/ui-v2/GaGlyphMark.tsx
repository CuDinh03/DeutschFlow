'use client'

import * as React from 'react'
import { useInViewOnce } from '@/hooks/useInViewOnce'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { GLYPHS, type GlyphName, type GlyphShape } from '@/lib/galerieGlyphs'
import { cn } from '@/lib/utils'

/**
 * GaGlyphMark — một biểu tượng trong bộ Galerie: nét mực vuông góc + đúng một mảng vàng, cùng ngữ
 * pháp với logo (luật hình học ở `mobile/GALERIE_GLYPHS.md`). Khác `GaGlyph` là ô icon bọc Lucide.
 *
 * Chỉ dùng cho biểu tượng NHẬN DIỆN (điều hướng, ô tính năng). Nút điều khiển (đóng, mũi tên, tìm
 * kiếm…) giữ `GaIcon`/Lucide, giống quy ước của mobile.
 *
 * Nét mực nhận `currentColor`, nên `text-ga-accent`/`text-ga-subtle` dùng như với `GaIcon`; mảng vàng
 * giữ nguyên ở mọi trạng thái.
 *
 * `draw`: `hover` vẽ lại nét khi rê chuột vào phần tử cha có class `group`; `view` vẽ một lần khi cuộn
 * tới. Không truyền thì đứng yên, và không bao giờ chuyển động với người bật giảm chuyển động.
 */
export type GaGlyphDraw = 'none' | 'hover' | 'view'

export interface GaGlyphMarkProps {
  name: GlyphName
  size?: number
  draw?: GaGlyphDraw
  title?: string
  className?: string
}

const DRAW_MS = 1000

function Shape({ shape, ...rest }: { shape: GlyphShape } & React.SVGProps<SVGElement>) {
  const props = rest as React.SVGProps<never>
  if (typeof shape === 'string') return <path d={shape} {...props} />
  if ('r' in shape) {
    const [x, y, width, height] = shape.r
    return <rect x={x} y={y} width={width} height={height} {...props} />
  }
  const [cx, cy, r] = shape.c
  return <circle cx={cx} cy={cy} r={r} {...props} />
}

export function GaGlyphMark({ name, size = 24, draw = 'none', title, className }: GaGlyphMarkProps) {
  const glyph = GLYPHS[name]
  const calm = usePrefersReducedMotion()
  const [drawing, setDrawing] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout>>()
  React.useEffect(() => () => clearTimeout(timer.current), [])

  const ref = useInViewOnce<SVGSVGElement>(() => {
    if (draw !== 'view' || calm) return
    setDrawing(true)
    timer.current = setTimeout(() => setDrawing(false), DRAW_MS)
  }, 0.6)

  // Nét đặt trên mảng màu lớn phải giữ màu mực ở cả nền tối (`hoanthanh`: ô vàng 16×16 chứa dấu tick).
  const onGold = glyph.gold.some((s) => typeof s === 'object' && 'r' in s && s.r[2] > 10)

  return (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      data-drawing={drawing || undefined}
      className={cn('ga-glyph shrink-0', draw === 'hover' && 'ga-glyph-hover', className)}
    >
      {/* Thứ tự vẽ theo luật hình học: vàng → đỏ → nét mực, để nét không bao giờ bị mảng màu che. */}
      {glyph.gold.map((s, i) => <Shape key={`g${i}`} shape={s} className="ga-glyph-gold" fill="var(--ga-yellow)" />)}
      {glyph.red?.map((s, i) => <Shape key={`r${i}`} shape={s} className="ga-glyph-gold" fill="var(--ga-red)" />)}
      {glyph.ink.map((s, i) => (
        <Shape
          key={`i${i}`}
          shape={s}
          className="ga-glyph-ink"
          pathLength={1}
          stroke={onGold ? 'var(--ga-ink)' : 'currentColor'}
          strokeWidth={1.75}
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      ))}
    </svg>
  )
}
