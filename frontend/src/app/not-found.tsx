'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useTracking } from '@/hooks/useTracking'

export default function NotFound() {
  const router = useRouter()
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
            404
          </h1>
          <h2 className="text-3xl font-semibold text-white">
            Seite nicht gefunden
          </h2>
          <p className="text-gray-400 text-lg max-w-md mx-auto">
            Die Seite, die Sie suchen, existiert nicht oder wurde verschoben.
          </p>
        </div>

        <div className="flex gap-4 justify-center pt-4">
          <Button
            onClick={() => router.back()}
            variant="outline"
            className="text-white border-white hover:bg-white hover:text-black"
          >
            Zurück
          </Button>
          <Button
            onClick={() => router.push('/')}
            className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white"
          >
            Zur Startseite
          </Button>
        </div>
      </div>
    </div>
  )
}
