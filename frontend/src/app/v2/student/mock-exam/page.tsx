import { redirect } from 'next/navigation'

/** Phần luyện thi cũ đã bỏ (06/11/2026) — mọi việc chuẩn bị thi nằm ở trang Luyện thi. */
export default function LegacyExamPrepRedirect() {
  redirect('/v2/student/exam')
}
