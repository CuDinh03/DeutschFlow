'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { GaPageHdr, TkSeg } from '@/components/ui-v2'
import { MessagesView } from '../../messagesShared'
import { ComposePicker } from './ComposePicker'
import { ClassChannelView } from './ClassChannelView'

type Mode = 'direct' | 'class'

function Body() {
  const t = useTranslations('v2.teacher.messages')
  const sp = useSearchParams()
  const to = sp.get('to')
  const [mode, setMode] = useState<Mode>('direct')

  return (
    <>
      <div className="flex items-center px-4 py-3 md:px-6">
        <TkSeg<Mode>
          value={mode}
          onValueChange={setMode}
          aria-label={t('modeAria')}
          options={[
            { value: 'direct', label: t('modeDirect') },
            { value: 'class', label: t('modeClass') },
          ]}
        />
      </div>

      {mode === 'direct' ? (
        <MessagesView
          initialUserId={to ? Number(to) : null}
          initialName={sp.get('name')}
          headerAction={(openThread) => <ComposePicker onPick={openThread} />}
          emptyText={t('emptyDirect')}
        />
      ) : (
        <ClassChannelView />
      )}
    </>
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
