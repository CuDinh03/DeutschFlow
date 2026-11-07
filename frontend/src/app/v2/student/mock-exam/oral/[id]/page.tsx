'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { ExamRoom } from '@/components/features/exam-speaking/ExamRoom'
import { safeReturn } from '@/lib/exam/oralRoutes'

/** Phòng thi nói của một phiên (drill/mock): Chuẩn bị → Đang thi → Đang chấm → Kết quả. */
export default function OralExamSessionPage() {
  const params = useParams<{ id: string }>()
  const search = useSearchParams()
  const id = Number(params?.id)
  if (!Number.isFinite(id)) return null
  return <ExamRoom sessionId={id} returnHref={safeReturn(search?.get('return'))} />
}
