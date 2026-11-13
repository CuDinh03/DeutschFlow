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
