'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { GaPageHdr, TkSeg } from '@/components/ui-v2'
import { MessagesView } from '../../messagesShared'
import { ComposePicker } from './ComposePicker'
import { ClassChannelView } from './ClassChannelView'

type Mode = 'direct' | 'class'

function Body() {
  const sp = useSearchParams()
  const to = sp.get('to')
  const [mode, setMode] = useState<Mode>('direct')

  return (
    <>
      <div className="flex items-center px-4 py-3 md:px-6">
        <TkSeg<Mode>
          value={mode}
          onValueChange={setMode}
          aria-label="Chế độ nhắn tin"
          options={[
            { value: 'direct', label: 'Trực tiếp' },
            { value: 'class', label: 'Nhóm lớp' },
          ]}
        />
      </div>

      {mode === 'direct' ? (
        <MessagesView
          initialUserId={to ? Number(to) : null}
          initialName={sp.get('name')}
          headerAction={(openThread) => <ComposePicker onPick={openThread} />}
          emptyText="Chưa có hội thoại. Nhấn “Nhắn học viên” ở trên để bắt đầu trò chuyện riêng với học viên."
        />
      ) : (
        <ClassChannelView />
      )}
    </>
  )
}

export default function TeacherMessagesPage() {
  return (
    <div className="flex h-full flex-col">
      <GaPageHdr accent title="Tin nhắn" subtitle="Nhắn riêng từng học viên hoặc cả nhóm lớp" />
      <Suspense fallback={<div className="flex-1" />}>
        <Body />
      </Suspense>
    </div>
  )
}
