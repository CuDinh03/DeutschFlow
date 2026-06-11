import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/siteUrl'

/**
 * robots.txt — cho phép index trang công khai, chặn khu vực sau đăng nhập & API.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/teacher/', '/student/', '/org/', '/api/', '/payment/'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
