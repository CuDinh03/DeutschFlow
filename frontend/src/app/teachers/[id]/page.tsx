import '@/styles/galerie.css'
import { notFound } from 'next/navigation'
import ClientPage from './client-page'
import { LandingHeader } from '@/components/landing-v2/LandingHeader'
import { LandingFooter } from '@/components/landing-v2/LandingFooter'
import { MARKETPLACE_ENABLED } from '@/lib/features'

export function generateStaticParams() {
  return [{ id: '_placeholder' }]
}

/**
 * Icon đợt B (09/11/2026): hồ sơ giáo viên chuyển sang Galerie, header/footer công khai bọc ngoài phần client.
 * Cùng cờ với danh sách `/teachers` (09/11/2026): marketplace tắt thì trang này cũng 404 — link quay lại danh
 * sách và nút Đặt lịch (`/v2/student/tutor`) đều dẫn vào trang đang tắt.
 */
export default function Page() {
  if (!MARKETPLACE_ENABLED) notFound()
  return (
    <div className="ga-scope min-h-screen overflow-x-clip bg-ga-bg font-ga-ui text-ga-ink">
      <LandingHeader current="none" showLanguage={false} />
      <ClientPage />
      <LandingFooter />
    </div>
  )
}
