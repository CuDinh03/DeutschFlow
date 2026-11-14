import type { Metadata } from 'next'
import { absoluteUrl } from '@/lib/siteUrl'
import '@/styles/galerie.css'
import { LegalDocGa } from '@/components/legal/LegalDocGa'
import { PRIVACY } from '@/content/legal/privacy'

export const metadata: Metadata = {
  title: 'Chính sách bảo mật · myDeutschFlow',
  description:
    'Chính sách bảo mật của myDeutschFlow: dữ liệu nào được thu thập, dùng vào việc gì và quyền của bạn với dữ liệu cá nhân (Privacy Policy, Datenschutz).',
  alternates: { canonical: absoluteUrl('/privacy/') },
}

/**
 * /privacy — the App Store Connect Privacy Policy URL. Rendered in the Galerie
 * homepage theme (`.ga-scope`) with a VN/EN/DE language switcher (LegalDocGa).
 */
export default function PrivacyPage() {
  return (
    <div className="ga-scope">
      <LegalDocGa docs={PRIVACY} />
    </div>
  )
}
