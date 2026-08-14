'use client'

import { RouteErrorCard } from '../routeErrorShared'

/**
 * Error boundary cho bề mặt tổ chức `/v2/org/*` — bắt trước `/v2/error.tsx` nên GaShell
 * (sidebar + thanh trên) còn nguyên khi một trang con chết. Lý do thiết kế: `routeErrorShared.tsx`.
 */
export default function V2OrgError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <RouteErrorCard error={error} reset={reset} scope="v2-org" frame="page" />
}
