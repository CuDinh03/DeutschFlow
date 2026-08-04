'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { GaPageHdr } from '@/components/ui-v2'
import { MessagesInbox } from '../../messages/MessagesInbox'
import { loadTeacherChannelClasses } from '../../messages/classLoaders'
import { ComposePicker } from './ComposePicker'

function Body() {
  const t = useTranslations('v2.teacher.messages')
  const sp = useSearchParams()
  const to = sp.get('to')
  return (
    <MessagesInbox
      loadClasses={loadTeacherChannelClasses}
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
