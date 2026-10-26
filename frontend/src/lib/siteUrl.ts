/**
 * Canonical public origin for the web app — used for SEO canonical URLs, Open Graph,
 * sitemap, and robots. Override per-environment with NEXT_PUBLIC_SITE_URL.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://mydeutschflow.com').replace(/\/$/, '')

/** Build an absolute URL from a site-relative path. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * Ảnh xem trước khi chia sẻ link (og:image) — TẠM là icon PNG 512×512.
 *
 * Trước 26/10/2026 trỏ `/icon.svg`, mà Facebook/Zalo/Messenger không hiển thị SVG → link chia sẻ
 * trong nhóm du học/lao động sang Đức không có ảnh. PNG vuông đủ để có ảnh thu nhỏ; ảnh ngang
 * 1200×630 chuẩn Open Graph là việc của đợt B (chờ owner duyệt hình).
 */
export const DEFAULT_OG_IMAGE = { url: '/icon-512.png', width: 512, height: 512, alt: 'myDeutschFlow' }
