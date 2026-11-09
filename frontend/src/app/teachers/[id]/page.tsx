import '@/styles/galerie.css'
import ClientPage from './client-page'
import { LandingHeader } from '@/components/landing-v2/LandingHeader'
import { LandingFooter } from '@/components/landing-v2/LandingFooter'

export function generateStaticParams() {
  return [{ id: '_placeholder' }]
}

/** Icon đợt B (09/11/2026): hồ sơ giáo viên chuyển sang Galerie, header/footer công khai bọc ngoài phần client. */
export default function Page() {
  return (
    <div className="ga-scope min-h-screen overflow-x-clip bg-ga-bg font-ga-ui text-ga-ink">
      <LandingHeader current="none" showLanguage={false} />
      <ClientPage />
      <LandingFooter />
    </div>
  )
}
