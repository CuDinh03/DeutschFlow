import '@/styles/galerie.css'
import type { Metadata } from 'next'
import { absoluteUrl } from '@/lib/siteUrl'
import { ogImage } from '@/lib/ogImage'
import FreeGradeClientPage from './client-page'
import { LandingHeader } from '@/components/landing-v2/LandingHeader'
import { LandingFooter } from '@/components/landing-v2/LandingFooter'

export const metadata: Metadata = {
  title: 'Chấm thử bài Schreiben B1 bằng AI — Miễn phí | myDeutschFlow',
  description:
    'Dán bài viết tiếng Đức, AI chấm theo thang 100 và nhận xét ngữ pháp, từ vựng, nội dung, bố cục. Miễn phí, không cần tạo tài khoản. Phù hợp bài Schreiben B1.',
  alternates: { canonical: absoluteUrl('/free-grade/') },
  openGraph: {
    title: 'Chấm thử bài Schreiben B1 bằng AI — Miễn phí',
    description:
      'AI chấm bài viết tiếng Đức theo thang 100 và chỉ ra chỗ cần sửa. Miễn phí, không cần tạo tài khoản.',
    type: 'website',
    url: absoluteUrl('/free-grade/'),
    locale: 'vi_VN',
    images: [ogImage('free-grade', 'vi', 'Chấm thử bài Schreiben B1 bằng AI — Miễn phí')],
  },
  robots: { index: true, follow: true },
}

/** Icon đợt B (09/11/2026): trang chấm thử chuyển sang Galerie — header/footer công khai bọc ngoài phần client. */
export default function FreeGradePage() {
  return (
    <div className="ga-scope min-h-screen overflow-x-clip bg-ga-bg font-ga-ui text-ga-ink">
      <LandingHeader current="exam" showLanguage={false} />
      <FreeGradeClientPage />
      <LandingFooter />
    </div>
  )
}
