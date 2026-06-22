'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { GaPageHdr } from '@/components/ui-v2'
import { MessagesView } from '../../messagesShared'

function Body() {
  const sp = useSearchParams()
  const to = sp.get('to')
  return <MessagesView initialUserId={to ? Number(to) : null} initialName={sp.get('name')} />
}

export default function StudentMessagesPage() {
  return (
    <div className="flex h-full flex-col">
      <GaPageHdr accent title="Tin nhắn" subtitle="Trao đổi trực tiếp với giáo viên của bạn" />
      <Suspense fallback={<div className="flex-1" />}>
        <Body />
      </Suspense>
    </div>
  )
}
