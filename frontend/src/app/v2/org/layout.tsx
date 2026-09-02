import * as React from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale } from 'next-intl/server'
import { GaShell } from '@/components/ui-v2'
import { messagesForV2Areas } from '@/i18n/pickV2Messages'

/**
 * /v2/org — organization role shell (sidebar + teal roleAccent via data-role).
 * W2: provider i18n riêng của khu — chỉ base + chrome + org (xem pickV2Messages).
 */
export default async function V2OrgLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await messagesForV2Areas('org')
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <GaShell role="org">{children}</GaShell>
    </NextIntlClientProvider>
  )
}
