import type { Metadata } from 'next'
import '@/styles/galerie.css'
import { LegalDocGa } from '@/components/legal/LegalDocGa'
import { TERMS } from '@/content/legal/terms'

export const metadata: Metadata = {
  title: 'Terms of Use · DeutschFlow',
  description: 'DeutschFlow Terms of Use / Điều khoản sử dụng / Nutzungsbedingungen.',
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
