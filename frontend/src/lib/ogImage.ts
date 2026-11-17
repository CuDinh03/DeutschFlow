import type { PublicLocale } from '@/lib/publicLocale'

/**
 * Ảnh chia sẻ 1200×630 (A3, kế hoạch cải thiện trang chủ 08/11/2026) — module chỉ dựng URL để trang
 * khai `openGraph.images`/`twitter.images`; ảnh do route `app/og/...` vẽ bằng `next/og`.
 *
 * Đuôi `.png` trên đường dẫn: middleware coi là tệp tĩnh và cho đi thẳng (không gắn ngôn ngữ), và
 * Facebook/Zalo nhận diện là ảnh. `v` để đổi ảnh thì đổi số — Facebook giữ ảnh cũ theo URL.
 */
export const OG_SIZE = { width: 1200, height: 630 } as const
export const OG_VERSION = '2'

export type OgPage = 'home' | 'luyen-thi' | 'trung-tam' | 'phong-van' | 'free-grade'

export const OG_PAGES: readonly OgPage[] = ['home', 'luyen-thi', 'trung-tam', 'phong-van', 'free-grade']

export function ogImage(page: OgPage, locale: PublicLocale, alt: string) {
  return { url: `/og/${page}.png?l=${locale}&v=${OG_VERSION}`, ...OG_SIZE, alt, type: 'image/png' }
}

export function occupationOgImage(code: string, locale: PublicLocale, alt: string) {
  return { url: `/og/nghe/${code}.png?l=${locale}&v=${OG_VERSION}`, ...OG_SIZE, alt, type: 'image/png' }
}

/**
 * Ảnh chia sẻ riêng của một bài Cẩm nang (đợt 0, 18/11/2026) — trước đây bài mượn ảnh trang nghề nên ảnh
 * không khớp tiêu đề bài. `v` lấy từ tiêu đề: đổi tên bài thì URL đổi, Facebook/Zalo lấy ảnh mới; đổi bài
 * khác không làm mới ảnh của mọi trang như `OG_VERSION`.
 */
export function guideOgImage(slug: string, title: string) {
  return { url: `/og/cam-nang/${slug}.png?v=${shortHash(title)}`, ...OG_SIZE, alt: title, type: 'image/png' }
}

/** Băm djb2 rút gọn 8 ký tự hex — chỉ để đổi URL khi chuỗi đổi, không dùng cho bảo mật. */
export function shortHash(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0
  return h.toString(16).padStart(8, '0')
}
