import type { Metadata } from 'next'
import { absoluteUrl } from '@/lib/siteUrl'
import '@/styles/galerie.css'
import { LegalDocGa } from '@/components/legal/LegalDocGa'
import { PRIVACY } from '@/content/legal/privacy'

export const metadata: Metadata = {
  title: 'Chính sách quyền riêng tư · myDeutschFlow',
  description: 'DeutschFlow Privacy Policy / Chính sách quyền riêng tư / Datenschutzerklärung.',
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
