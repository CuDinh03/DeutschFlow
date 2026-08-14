'use client'

import { RouteErrorCard } from '../routeErrorShared'

/**
 * Error boundary cho bề mặt học viên `/v2/student/*`.
 *
 * Khác `/v2/error.tsx` ở đúng một điều, và là điều quan trọng: boundary này nằm DƯỚI
 * `/v2/student/layout.tsx`, nên nó render bên trong `<main>` của GaShell — sidebar, thanh trên và
 * lối điều hướng còn nguyên. Một trang con chết không còn hất học viên ra màn hình trắng: họ đọc
 * được nguyên nhân rồi bấm thẳng sang mục khác.
 *
 * `frame="page"` vì `<main>` là vùng cuộn duy nhất của shell (xem GaShell): thẻ lấp đầy vùng nội
 * dung chứ KHÔNG tự dựng `min-h-screen` — nếu không sẽ đẩy sinh thanh cuộn thứ hai bên trong main.
 */
export default function V2StudentError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <RouteErrorCard error={error} reset={reset} scope="v2-student" frame="page" />
}
