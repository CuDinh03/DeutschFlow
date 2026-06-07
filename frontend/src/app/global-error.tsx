'use client'

// Top-level boundary for unhandled errors in the root layout itself. Renders its own
// <html>/<body> because at this level even the root layout has crashed.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="vi">
      <body className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-red-200 p-6 text-center space-y-4 shadow-sm">
          <div
            className="w-12 h-12 mx-auto rounded-full bg-red-50 flex items-center justify-center"
            aria-hidden
          >
            <span className="text-red-500 text-xl">⚠</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900">Đã xảy ra lỗi</h1>
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
      </body>
    </html>
  )
}
