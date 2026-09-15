'use client'

import { Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { GaPageHdr } from '@/components/ui-v2'
import { MessagesInbox } from '../../messages/MessagesInbox'
import { loadTeacherChannelClasses } from '../../messages/classLoaders'
import { ComposePicker } from './ComposePicker'

function Body() {
  const t = useTranslations('v2.teacher.messages')
  const ti = useTranslations('v2.inbox')
  // Loader identity ổn định theo locale (MessagesInbox key effect theo loader) — nhãn phụ đề đọc từ v2.inbox.
  const loadClasses = useMemo(
    () => () =>
      loadTeacherChannelClasses({
        teacherPrefix: (names) => ti('teacherPrefix', { names }),
        noTeacher: ti('noTeacher'),
        students: (count) => ti('studentsCount', { count }),
      }),
    [ti],
  )
  const sp = useSearchParams()
  const to = sp.get('to')
  return (
    <MessagesInbox
      loadClasses={loadClasses}
      initialUserId={to ? Number(to) : null}
      initialName={sp.get('name')}
      headerAction={(openDirect) => <ComposePicker onPick={openDirect} />}
      emptyDirectText={t('emptyDirect')}
    />
  )
}

export default function TeacherMessagesPage() {
  const t = useTranslations('v2.teacher.messages')
  return (
    <div className="flex h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
      <Suspense fallback={<div className="flex-1" />}>
        <Body />
      </Suspense>
    </div>
  )
}
