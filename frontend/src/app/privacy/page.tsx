import type { Metadata } from 'next'
import '@/styles/galerie.css'
import { LegalDocGa } from '@/components/legal/LegalDocGa'
import { PRIVACY } from '@/content/legal/privacy'

export const metadata: Metadata = {
  title: 'Privacy Policy · DeutschFlow',
  description: 'DeutschFlow Privacy Policy / Chính sách quyền riêng tư / Datenschutzerklärung.',
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
