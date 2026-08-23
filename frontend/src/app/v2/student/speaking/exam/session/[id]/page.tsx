'use client'

import { useParams } from 'next/navigation'
import { ExamRoom } from '@/components/features/exam-speaking/ExamRoom'

/** Phòng thi (drill/mock) của một phiên; kết quả mock cũng xem ở đây (state RESULTS). */
export default function V2ExamSpeakingSessionPage() {
  const params = useParams<{ id: string }>()
  const id = Number(params?.id)
  if (!Number.isFinite(id)) return null
  return <ExamRoom sessionId={id} catalogHref="/v2/student/speaking/exam" />
}
