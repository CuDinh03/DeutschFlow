import { redirect } from 'next/navigation'

/**
 * Trình thi thử cũ đã bỏ (06/11/2026). Link cũ `?examId=` chuyển sang thi thử trọn đề trong giao
 * diện mới; không có đề thì về trang Luyện thi.
 */
export default function LegacyMockExamRunRedirect({ searchParams }: { searchParams: { examId?: string } }) {
  const examId = Number(searchParams?.examId)
  redirect(examId > 0 ? `/v2/student/mock-exam/full?examId=${examId}` : '/v2/student/exam')
}
