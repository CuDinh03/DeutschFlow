'use client'

import '@/styles/galerie.css'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { GaBtn } from '@/components/ui-v2/GaBtn'
import { useTracking } from '@/hooks/useTracking'
import { DEFAULT_PUBLIC_LOCALE, isPublicLocale, localizedHref } from '@/lib/publicLocale'

/**
 * Trang 404 chung (cả mã nghề lạ ở `/phong-van/[nghe]`).
 *
 * Nghiệm thu prod 21/10/2026: bản trước viết cứng tiếng Đức, giao diện tối cũ, nút "Zurück" chữ trắng
 * trên nền trắng. Nay theo Galerie, chữ đọc từ `v2.error` (lõi chrome — mọi provider đều có) ba thứ
 * tiếng. Bỏ nút "quay lại": vào thẳng URL hỏng thì lịch sử trống, nút đó không đi đâu cả.
 */
export default function NotFound() {
  const t = useTranslations('v2.error')
  const raw = useLocale()
  const locale = isPublicLocale(raw) ? raw : DEFAULT_PUBLIC_LOCALE
  const { trackEvent } = useTracking()
  const sent = useRef(false)

  // Đo lỗ hổng của bảng redirect khi cây v1 bị xoá: bookmark/link cũ trỏ vào một route đã biến mất
  // mà bảng redirect chưa phủ sẽ rơi vào đây và, trước đợt này, không phát ra tín hiệu nào. `referrer`
  // phân biệt được người dùng đến từ trong app (link nội bộ còn sót) hay từ ngoài (email/bookmark).
  useEffect(() => {
    if (sent.current) return
    // PostHogProvider gọi posthog.init() trong effect của CHÍNH nó, mà effect của component con luôn
    // chạy TRƯỚC effect của cha → ở lần tải nguội (gõ thẳng URL hỏng) capture() gọi ngay tại đây sẽ
    // trúng instance chưa init và bị bỏ im lặng. Hoãn một macrotask để init đã chạy xong.
    const timer = setTimeout(() => {
      sent.current = true
      trackEvent('client_route_not_found', {
        path: window.location.pathname,
        referrer: document.referrer || 'direct',
      })
    }, 0)
    return () => clearTimeout(timer)
  }, [trackEvent])

  return (
    <div className="ga-scope flex min-h-screen items-center justify-center bg-ga-bg px-4 py-10">
      <div className="w-full max-w-md space-y-5 rounded-ga border border-ga-line bg-ga-card p-6 lg:p-8">
        <p aria-hidden className="font-ga-display text-[56px] font-medium leading-none text-ga-ink">
          404
        </p>
        <div className="space-y-2">
          <h1 className="font-ga-display text-[24px] font-medium text-ga-ink">{t('notFoundTitle')}</h1>
          <p className="ga-ui text-[14px] leading-relaxed text-ga-muted">{t('notFoundDesc')}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <GaBtn asChild variant="ink" size="lg">
            <Link href={localizedHref(locale, '/')}>{t('notFoundHome')}</Link>
          </GaBtn>
          <GaBtn asChild variant="ghost" size="lg">
            <Link href={localizedHref(locale, '/phong-van')}>{t('notFoundOccupations')}</Link>
          </GaBtn>
        </div>
      </div>
    </div>
  )
}
