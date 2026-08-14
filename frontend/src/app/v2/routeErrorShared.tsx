'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
// Import THẲNG từ file component, không qua barrel `@/components/ui-v2`: barrel kéo theo cả
// GaShell/GaSidebar/DataTable… vào chunk của thẻ lỗi. Một trang lỗi phải phụ thuộc vào càng ít
// module càng tốt — nó là thứ chạy KHI mọi thứ khác đã hỏng.
import { GaBtn } from '@/components/ui-v2/GaBtn'
import { GaIcon } from '@/components/ui-v2/GaIcon'

/**
 * Ruột chung của các `error.tsx` trong /v2 (`/v2/error.tsx`, `/v2/student/error.tsx`, …).
 *
 * Mỗi boundary chỉ khác nhau ở HAI thứ: khung bao (có shell hay không) và nhãn `scope` gửi lên
 * PostHog. Nội dung thẻ thì phải giống hệt nhau — thêm một boundary nữa mà chép lại toàn bộ markup
 * là cách chắc chắn nhất để hai trang lỗi trôi khỏi nhau sau vài tháng.
 *
 * Điều thẻ này làm mà `src/app/error.tsx` không làm: IN RA `error.message`. Lỗi client không có
 * `digest` (Next chỉ gắn digest cho lỗi server), nên nếu không in message thì người báo lỗi không có
 * gì để chụp và người sửa không có gì để lần.
 */

/** Dấu hiệu tệp JS của bản triển khai cũ không còn trên máy chủ (Next/webpack + Safari/Firefox). */
const STALE_CHUNK =
  /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i

export interface RouteErrorCardProps {
  error: Error & { digest?: string }
  reset: () => void
  /** Nhãn tầng bắt lỗi, đi kèm event PostHog `client_route_error` để lọc theo bề mặt. */
  scope: string
  /**
   * `screen` — boundary thay cả trang (không còn GaShell): tự căn giữa toàn màn hình.
   * `page` — boundary nằm TRONG `<main>` của GaShell (sidebar còn nguyên): lấp đầy vùng nội dung.
   */
  frame?: 'screen' | 'page'
}

export function RouteErrorCard({ error, reset, scope, frame = 'screen' }: RouteErrorCardProps) {
  const t = useTranslations('v2.error')
  const tc = useTranslations('v2.common')
  const stale = STALE_CHUNK.test(`${error.name} ${error.message}`)

  useEffect(() => {
    console.error(`[${scope} route error]`, error)
    if (posthog.__loaded) {
      posthog.capture('client_route_error', {
        scope,
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        errorName: error.name,
        staleChunk: stale,
        path: typeof window !== 'undefined' ? window.location.pathname : undefined,
      })
    }
  }, [error, scope, stale])

  return (
    <div
      // `h-full` (không phải min-height) để thẻ căn giữa đúng vùng nội dung: `<main>` của GaShell đã
      // có chiều cao xác định và tự cuộn, nên đặt sàn chiều cao ở đây chỉ sinh thanh cuộn thừa trên
      // màn thấp.
      className={`flex items-center justify-center px-4 py-10 ${
        frame === 'page' ? 'h-full' : 'min-h-screen'
      }`}
    >
      <div
        role="alert"
        className="w-full max-w-md space-y-4 rounded-ga border border-ga-line bg-ga-card p-6 lg:p-7"
      >
        <span className="grid h-12 w-12 place-items-center rounded-ga-pill bg-ga-red-soft text-ga-red">
          <GaIcon name="error" size={24} />
        </span>

        <div className="space-y-1.5">
          <h1 className="font-ga-display text-[21px] font-medium text-ga-ink">
            {stale ? t('staleTitle') : t('title')}
          </h1>
          <p className="ga-ui text-[13.5px] leading-relaxed text-ga-muted">
            {stale ? t('staleDesc') : t('desc')}
          </p>
        </div>

        {/* Cái mà thẻ lỗi cũ thiếu: nguyên nhân thật, đủ để chụp màn hình gửi đi. */}
        <div className="space-y-1 rounded-ga border border-dashed border-ga-line bg-ga-surface px-3 py-2.5">
          <p className="ga-ui text-[11px] uppercase tracking-wide text-ga-subtle">
            {t('detailsCap')}
          </p>
          <p className="break-words font-mono text-[12px] leading-relaxed text-ga-ink">
            {error.message || t('noMessage')}
          </p>
          {error.digest && (
            <p className="ga-ui font-mono text-[11.5px] text-ga-subtle">
              {t('digestLabel')}: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Chunk cũ thì `reset()` chỉ render lại đúng cây đã hỏng — tải lại trang mới là lối ra. */}
          {stale ? (
            <>
              <GaBtn onClick={() => window.location.reload()}>{t('reload')}</GaBtn>
              <GaBtn variant="ghost" onClick={reset}>
                {tc('retry')}
              </GaBtn>
            </>
          ) : (
            <>
              <GaBtn onClick={reset}>{tc('retry')}</GaBtn>
              <GaBtn variant="ghost" onClick={() => window.location.reload()}>
                {t('reload')}
              </GaBtn>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
