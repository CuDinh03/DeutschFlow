'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { GaPageHdr } from '@/components/ui-v2'
import { MessagesInbox } from '../../messages/MessagesInbox'
import { loadStudentChannelClasses } from '../../messages/classLoaders'

function Body() {
  const sp = useSearchParams()
  const to = sp.get('to')
  return (
    <MessagesInbox
      loadClasses={loadStudentChannelClasses}
      initialUserId={to ? Number(to) : null}
      initialName={sp.get('name')}
      emptyDirectText="Chưa có hội thoại riêng. Mở trang lớp và nhấn “Nhắn giáo viên” để bắt đầu."
    />
  )
}

export default function StudentMessagesPage() {
  const t = useTranslations('v2.student.messages')
  return (
    <div className="flex h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
      <Suspense fallback={<div className="flex-1" />}>
        <Body />
      </Suspense>
    </div>
  )
}
