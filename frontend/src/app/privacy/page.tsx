import type { Metadata } from 'next'
import { absoluteUrl } from '@/lib/siteUrl'
import '@/styles/galerie.css'
import { LegalDocGa } from '@/components/legal/LegalDocGa'
import { PublicShell } from '@/components/landing-v2/PublicShell'
import { PRIVACY } from '@/content/legal/privacy'

export const metadata: Metadata = {
  title: 'Chính sách bảo mật · myDeutschFlow',
  description:
    'Chính sách bảo mật của myDeutschFlow: dữ liệu nào được thu thập, dùng vào việc gì và quyền của bạn với dữ liệu cá nhân (Privacy Policy, Datenschutz).',
  alternates: { canonical: absoluteUrl('/privacy/') },
}

/**
 * `/privacy/` — đường dẫn Chính sách bảo mật đăng ký trên App Store Connect, hiển thị trên `PublicShell` v3.4
 * kèm thanh chọn ngôn ngữ văn bản VI / EN / DE (`LegalDocGa`).
 */
export default function PrivacyPage() {
  return (
    <PublicShell showLanguage={false} stickyCta={false}>
      <LegalDocGa docs={PRIVACY} />
    </PublicShell>
  )
}
