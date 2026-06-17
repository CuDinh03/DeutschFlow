import * as React from 'react'
import type { IconPaths } from '@/lib/learning-tree/render/icons'

interface TreeIconProps {
  paths: IconPaths
  size?: number
  color?: string
  strokeWidth?: number
  /** When set, renders a nested <svg x/y> so the icon positions inside a parent SVG. */
  x?: number
  y?: number
  className?: string
}

/**
 * A 24×24 stroke icon. Renders a self-contained `<svg>`, so it works both standalone in HTML (legend
 * key) and nested inside the tree SVG (skill badge) via x/y. Decorative by default (aria-hidden).
 */
export function TreeIcon({
  paths,
  size = 16,
  color = 'currentColor',
  strokeWidth = 2,
  x,
  y,
  className,
}: TreeIconProps): React.ReactElement {
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
