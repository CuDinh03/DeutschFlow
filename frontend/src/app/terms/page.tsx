import type { Metadata } from 'next'
import { absoluteUrl } from '@/lib/siteUrl'
import '@/styles/galerie.css'
import { LegalDocGa } from '@/components/legal/LegalDocGa'
import { PublicShell } from '@/components/landing-v2/PublicShell'
import { TERMS } from '@/content/legal/terms'

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng · myDeutschFlow',
  description:
    'Điều khoản sử dụng myDeutschFlow: tài khoản, gói trả phí, quy tắc sử dụng, quyền sở hữu nội dung (Terms of Use / Nutzungsbedingungen).',
  alternates: { canonical: absoluteUrl('/terms/') },
}

/**
 * `/terms/` — đường dẫn Điều khoản sử dụng (EULA) đăng ký trên App Store Connect, hiển thị trên `PublicShell` v3.4
 * kèm thanh chọn ngôn ngữ văn bản VI / EN / DE (`LegalDocGa`).
 */
export default function TermsPage() {
  return (
    <PublicShell showLanguage={false} stickyCta={false}>
      <LegalDocGa docs={TERMS} />
    </PublicShell>
  )
}
