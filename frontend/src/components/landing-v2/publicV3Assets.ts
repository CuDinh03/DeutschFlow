import type { StaticImageData } from 'next/image'

import koelnMistHero from '../../assets/public-v3/koeln-rhein-mist-hero.webp'
import berlinMistHero from '../../assets/public-v3/berlin-brandenburg-mist.webp'
import kruegerPflege3d from '../../assets/public-v3/krueger-pflege-3d.webp'
import klausKueche3d from '../../assets/public-v3/klaus-kueche-3d.webp'
import brandIdentitySheetV3 from '../../assets/public-v3/brand-identity-sheet-v3.webp'

/**
 * Kho nguyên liệu hình ảnh chuẩn `Warm Modern German EdTech v3.4` (14/11/2026).
 *
 * Dùng import TĨNH từ `src/assets/public-v3/` (cùng quy ước với `landingShots.ts` & AC-AUD-11):
 * - Next.js phục vụ trực tiếp từ `/_next/static/media/…` (tương thích `images.unoptimized = true`).
 * - Giữ kích thước nội tại ngay từ khung hình đầu (`CLS = 0`).
 * - Thiếu file sẽ đổ build ngay thay vì thành ảnh 404 lặng lẽ trên production.
 */
export const PUBLIC_V3_ASSETS: {
  koelnMistHero: StaticImageData
  berlinMistHero: StaticImageData
  kruegerPflege3d: StaticImageData
  klausKueche3d: StaticImageData
  brandIdentitySheetV3: StaticImageData
} = {
  koelnMistHero,
  berlinMistHero,
  kruegerPflege3d,
  klausKueche3d,
  brandIdentitySheetV3,
}
