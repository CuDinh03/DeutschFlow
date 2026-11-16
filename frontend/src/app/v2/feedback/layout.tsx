import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale } from 'next-intl/server'
import { messagesForV2Areas } from '@/i18n/pickV2Messages'

export const metadata: Metadata = { robots: { index: false, follow: false } }

/** Trang Góp ý dùng chung mọi vai trò (đặc tả gopycapnhat): chuỗi nằm ở `v2.account.feedback`. */
export default async function FeedbackLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale()
  const messages = await messagesForV2Areas('account')
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
