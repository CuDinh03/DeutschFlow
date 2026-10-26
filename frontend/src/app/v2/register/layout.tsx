import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import { messagesForV2Areas } from '@/i18n/pickV2Messages'

/**
 * Layout khai metadata (page.tsx là client component nên không xuất được `metadata`) và cấp
 * provider i18n riêng của trang — đợt A 26/10/2026: phần này từng nằm ở provider GỐC nên mọi
 * trang, kể cả trang chủ, cõng nó trong HTML.
 * 18/10/2026 (đợt 0): trước trang này dùng title gốc tiếng Anh chung cho mọi trang.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('v2.auth.register')
  return { title: `${t('title')} · myDeutschFlow`, description: t('subtitle') }
}

export default async function RegisterLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale()
  const messages = await messagesForV2Areas('auth')
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
