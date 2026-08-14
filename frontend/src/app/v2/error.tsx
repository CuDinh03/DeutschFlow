'use client'

import { RouteErrorCard } from './routeErrorShared'

/**
 * Error boundary cho toàn bộ cây `/v2` — lưới cuối cùng trước `src/app/error.tsx`.
 *
 * Nó bắt lỗi của mọi layout/page BÊN DƯỚI `/v2/layout.tsx`, nên khi nó hiện thì GaShell đã bị thay
 * (không còn sidebar) — đó là lý do các tầng vai có boundary riêng ở dưới: `/v2/student/error.tsx`
 * bắt trước và giữ được shell. Tới đây thì hoặc lỗi nằm ở tầng vai chưa có boundary, hoặc chính
 * layout theo vai đã chết.
 *
 * Lỗi trong CHÍNH `/v2/layout.tsx` (V2Gate) vẫn rơi xuống boundary gốc như cũ: `error.tsx` không bắt
 * được layout cùng tầng với nó.
 */
export default function V2Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <RouteErrorCard error={error} reset={reset} scope="v2" frame="screen" />
}
