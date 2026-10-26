import type { ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale } from 'next-intl/server'
import { messagesForV2Areas } from '@/i18n/pickV2Messages'

/**
 * Provider i18n riêng của trang — đợt A tốc độ trang chủ (26/10/2026): phần `auth` từng nằm ở
 * provider GỐC nên mọi trang (kể cả trang chủ) cõng nó trong HTML. Nay chỉ trang cần mới mang.
 */
export default async function ForgotPasswordLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale()
  const messages = await messagesForV2Areas('auth')
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
