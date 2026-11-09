import type { ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale } from 'next-intl/server'
import { messagesForV2Areas } from '@/i18n/pickV2Messages'

/**
 * Trang đổi mã phiên hỗ trợ chỉ-đọc (V370). Chuỗi nằm ở lõi chrome (`v2.supportSession`) — banner trong GaShell
 * dùng chung — nên provider chỉ cần lõi.
 */
export default async function SupportSessionLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale()
  const messages = await messagesForV2Areas()
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
