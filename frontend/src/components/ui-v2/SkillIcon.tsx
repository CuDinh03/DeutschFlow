import * as React from 'react'
import type { IconPaths } from '@/lib/skills'

interface SkillIconProps {
  paths: IconPaths
  size?: number
  color?: string
  strokeWidth?: number
  /** Khi có, render `<svg x/y>` lồng nhau để icon định vị được bên trong một SVG cha. */
  x?: number
  y?: number
  className?: string
}

/**
 * Icon nét 24×24. Render một `<svg>` tự chứa nên dùng được cả độc lập trong HTML lẫn lồng trong
 * SVG cha qua x/y. Mặc định là trang trí (aria-hidden) — nhãn chữ đi kèm mới mang nghĩa.
 */
export function SkillIcon({
  paths,
  size = 16,
  color = 'currentColor',
  strokeWidth = 2,
  x,
  y,
  className,
}: SkillIconProps): React.ReactElement {
  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}
