import type { Metadata } from 'next'
import { absoluteUrl } from '@/lib/siteUrl'
import '@/styles/galerie.css'
import { LegalDocGa } from '@/components/legal/LegalDocGa'
import { TERMS } from '@/content/legal/terms'

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng · myDeutschFlow',
  description: 'Điều khoản sử dụng myDeutschFlow: tài khoản, gói trả phí, quy tắc sử dụng, quyền sở hữu nội dung (Terms of Use / Nutzungsbedingungen).',
  alternates: { canonical: absoluteUrl('/terms/') },
}

/**
 * /terms — the App Store Connect EULA URL. Rendered in the Galerie homepage
 * theme (`.ga-scope`) with a VN/EN/DE language switcher (LegalDocGa), matching /privacy.
 */
export default function TermsPage() {
  return (
    <div className="ga-scope">
      <LegalDocGa docs={TERMS} />
    </div>
  )
}
