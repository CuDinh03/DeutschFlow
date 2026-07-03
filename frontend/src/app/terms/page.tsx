import type { Metadata } from 'next'
import { LegalDoc } from '@/components/legal/LegalDoc'
import { TERMS_MD } from '@/content/legal/terms'

export const metadata: Metadata = {
  title: 'Terms of Use · DeutschFlow',
  description: 'DeutschFlow Terms of Use / Điều khoản sử dụng.',
}

export default function TermsPage() {
  return <LegalDoc markdown={TERMS_MD} />
}
