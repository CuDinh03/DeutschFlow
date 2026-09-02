import * as React from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale } from 'next-intl/server'
import { GaShell } from '@/components/ui-v2'
import { messagesForV2Areas } from '@/i18n/pickV2Messages'

/**
 * /v2/student — Galerie 2.0 student surface. Yellow accent (`data-role="student"`
 * already defined in galerie.css). Nav is SCOPED to the teacher-interaction screens
 * (my-classes · st-progress · tutor) for this cohort; the full student-daily nav
 * lands in P6.
 *
 * W2 audit lag 02/09: provider i18n riêng của khu — HTML trang student chỉ mang
 * base + chrome + student thay vì trọn catalog 9 khu (xem pickV2Messages).
 */
export default async function V2StudentLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await messagesForV2Areas('student')
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <GaShell role="student">{children}</GaShell>
    </NextIntlClientProvider>
  )
}
