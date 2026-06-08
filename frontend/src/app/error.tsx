'use client'

// Route-level error boundary for the app root. Without this file, any uncaught render
// error in /(student|teacher|admin)/* — or in the root layout's client children — kills
// the entire page with a blank white screen in production.

import { useEffect } from 'react'
import posthog from 'posthog-js'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[root route error]', error)
    if (posthog.__loaded) {
      posthog.capture('client_route_error', {
        scope: 'root',
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        path: typeof window !== 'undefined' ? window.location.pathname : undefined,
      })
    }
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-red-200 p-6 text-center space-y-4 shadow-sm">
        <div
          className="w-12 h-12 mx-auto rounded-full bg-red-50 flex items-center justify-center"
          aria-hidden
        >
          <span className="text-red-500 text-xl">⚠</span>
        </div>
        <h2 className="text-lg font-bold text-slate-900">Có lỗi xảy ra</h2>
        <p className="text-slate-500 text-sm">Vui lòng thử lại sau ít phút.</p>
        {error.digest ? (
          <p className="text-xs text-slate-400 font-mono">Mã lỗi: {error.digest}</p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          Thử lại
        </button>
      </div>
    </div>
  )
}
