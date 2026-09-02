import * as React from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale } from 'next-intl/server'
import { GaShell } from '@/components/ui-v2'
import { messagesForV2Areas } from '@/i18n/pickV2Messages'

/**
 * /v2/teacher — teacher role shell (sidebar + violet roleAccent via data-role).
 * W2: provider i18n riêng của khu — chỉ base + chrome + teacher (xem pickV2Messages).
 */
export default async function V2TeacherLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await messagesForV2Areas('teacher')
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <GaShell role="teacher">{children}</GaShell>
    </NextIntlClientProvider>
  )
}
