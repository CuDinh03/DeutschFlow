import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

/**
 * Layout chỉ để khai metadata: page.tsx là client component nên không xuất được `metadata`.
 * 18/10/2026 (đợt 0): trước trang này dùng title gốc tiếng Anh chung cho mọi trang.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('v2.auth.register')
  return { title: `${t('title')} · myDeutschFlow`, description: t('subtitle') }
}

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return children
}
