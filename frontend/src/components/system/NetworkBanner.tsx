'use client'

import { useEffect, useState } from 'react'

// Slide-down banner shown whenever the device loses connectivity mid-session.
// Uses the browser's online/offline events (navigator.onLine) — the Capacitor @capacitor/network
// dependency was retired (S20b); its web behaviour was already navigator.onLine under the hood.
export function NetworkBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const update = () => setOffline(typeof navigator !== 'undefined' && navigator.onLine === false)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 z-[60] flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white"
      style={{
        top: 'env(safe-area-inset-top, 0px)',
        background: 'linear-gradient(135deg, #B91C1C, #DC2626)',
        boxShadow: '0 4px 16px rgba(220,38,38,0.35)',
        animation: 'networkBannerIn 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636L5.636 18.364m12.728 0L5.636 5.636M12 18.5a.5.5 0 100-1 .5.5 0 000 1z" />
      </svg>
      <span>Mất kết nối mạng — một số tính năng tạm thời không khả dụng</span>
    </div>
  )
}
