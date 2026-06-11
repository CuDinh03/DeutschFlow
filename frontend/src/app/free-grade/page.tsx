import type { Metadata } from 'next'
import FreeGradeClientPage from './client-page'

export const metadata: Metadata = {
  title: 'Chấm thử bài Schreiben B1 bằng AI — Miễn phí | DeutschFlow',
  description:
    'Dán bài viết tiếng Đức (Schreiben B1) và nhận điểm + nhận xét chi tiết từ AI trong 15 giây. Miễn phí, không cần đăng ký. Chuẩn Goethe/telc, dành cho giáo viên và học viên.',
  openGraph: {
    title: 'Chấm thử bài Schreiben B1 bằng AI — Miễn phí',
    description:
      'Nhận điểm + nhận xét chi tiết cho bài viết tiếng Đức của bạn trong 15 giây. Miễn phí, chuẩn Goethe/telc.',
    type: 'website',
  },
  robots: { index: true, follow: true },
}

export default function FreeGradePage() {
  return <FreeGradeClientPage />
}
