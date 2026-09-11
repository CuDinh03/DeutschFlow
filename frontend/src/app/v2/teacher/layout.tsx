import * as React from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale } from 'next-intl/server'
import { GaShell } from '@/components/ui-v2'
import { RoleAreaGuard } from '../RoleAreaGuard'
import { OrgLicenseProvider } from '../OrgLicenseGate'
import { messagesForV2Areas } from '@/i18n/pickV2Messages'

/**
 * /v2/teacher — teacher role shell (sidebar + violet roleAccent via data-role).
 * W2: provider i18n riêng của khu — chỉ base + chrome + teacher (xem pickV2Messages).
 *
 * Gói 2 (D5/E1): giáo viên của trung tâm chỉ-đọc cũng phải THẤY trạng thái đó, không chỉ org-admin
 * — chính giáo viên mới là người bấm "Giao bài", "Thêm học viên", "Thêm trợ giảng" và ăn 403.
 * Provider tự bỏ qua khi người dùng không thuộc trung tâm nào (giáo viên B2C thuần), nên khu này
 * không phát sinh lời gọi thừa. Chuỗi của băng nằm trong `chrome.*.json` (`v2.orgReadOnly`) đúng vì
 * nó là chrome dùng chung hai khu — mọi provider đều mang sẵn phần lõi chrome.
 */
export default async function V2TeacherLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await messagesForV2Areas('teacher')
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <RoleAreaGuard area="teacher">
        <GaShell role="teacher">
          <OrgLicenseProvider>{children}</OrgLicenseProvider>
        </GaShell>
      </RoleAreaGuard>
    </NextIntlClientProvider>
  )
}
