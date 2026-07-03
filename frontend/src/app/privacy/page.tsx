import type { Metadata } from 'next'
import { LegalDoc } from '@/components/legal/LegalDoc'
import { PRIVACY_MD } from '@/content/legal/privacy'

export const metadata: Metadata = {
  title: 'Privacy Policy · DeutschFlow',
  description: 'DeutschFlow Privacy Policy / Chính sách quyền riêng tư.',
}

export default function PrivacyPage() {
  return <LegalDoc markdown={PRIVACY_MD} />
}
