import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/siteUrl'

/**
 * robots.txt — cho phép index trang công khai, chặn khu vực sau đăng nhập & API.
 *
 * `/v2/` là khu vực sau đăng nhập THẬT từ Đợt 3 (cây v1 đã bị xoá). Bốn prefix v1 bên dưới không
 * còn trang nào trên đĩa nhưng vẫn là redirect 308 sống trong `next.config.mjs` — giữ lại để
 * crawler không lần theo backlink cũ rồi bò tiếp vào khu vực riêng tư qua đường vòng.
 *
 * Trang marketing/SEO đều nằm ở gốc (`/`, `/luyen-thi`, `/free-grade`, `/giao-vien-mien-phi`,
 * `/teachers`, …) nên không bị các luật này chạm tới — xem `sitemap.ts`.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/v2/', '/admin/', '/teacher/', '/student/', '/org/', '/api/', '/payment/'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
