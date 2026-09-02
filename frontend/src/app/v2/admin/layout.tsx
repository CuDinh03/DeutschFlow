import * as React from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale } from 'next-intl/server'
import { GaShell } from '@/components/ui-v2'
import { messagesForV2Areas } from '@/i18n/pickV2Messages'

/**
 * /v2/admin — admin role shell (sidebar + navy roleAccent via data-role).
 * W2: provider i18n riêng của khu — base + chrome + adminOps + adminContent;
 * thêm nhánh student.examSpeaking vì exam-bank render StimulusCard của khu student.
 */
export default async function V2AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await messagesForV2Areas('adminOps', 'adminContent', 'student.examSpeaking')
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <GaShell role="admin">{children}</GaShell>
    </NextIntlClientProvider>
  )
}
