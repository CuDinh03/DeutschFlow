import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Cỡ chữ Galerie (`text-ga-body`, `text-ga-small`…) khai báo cho tailwind-merge. Thiếu khai báo này,
 * twMerge coi `text-ga-small` và `text-ga-muted` là cùng nhóm màu chữ nên `cn('text-ga-small',
 * 'text-ga-muted')` lặng lẽ bỏ mất cỡ chữ (đợt (d) Luyện thi, 07/11/2026). Danh sách khớp
 * `theme.extend.fontSize` trong tailwind.config.
 */
const GA_FONT_SIZES = [
  "ga-body",
  "ga-body-lg",
  "ga-caption",
  "ga-display",
  "ga-display-m",
  "ga-eyebrow",
  "ga-h1",
  "ga-h1-m",
  "ga-h2",
  "ga-h3",
  "ga-numeral",
  "ga-small",
  "ga-stat",
  "ga-stat-label",
  "ga-stat-m",
  "ga-vocab",
];

const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: GA_FONT_SIZES }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
