"use client"

const SHARED_DASHBOARD_URL = process.env.NEXT_PUBLIC_POSTHOG_SHARED_DASHBOARD_URL

export default function AdminAnalyticsPage() {

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0B1120] p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          Product Analytics
        </h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          Theo dõi hành vi người dùng, tỷ lệ chuyển đổi và hiệu suất hệ thống theo thời gian thực.
        </p>
      </div>

      {/* PostHog Shared Dashboard iframe */}
      <div className="w-full h-[800px] bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden relative">
        <iframe
          src={process.env.NEXT_PUBLIC_POSTHOG_SHARED_DASHBOARD_URL || "https://us.posthog.com/embedded/YOUR_SHARED_DASHBOARD_ID"}
          width="100%"
          height="100%"
          frameBorder="0"
          className="absolute inset-0"
          title="Product Analytics Dashboard"
        />
        {/* Helper overlay for dev environment if URL is not configured */}
        {!process.env.NEXT_PUBLIC_POSTHOG_SHARED_DASHBOARD_URL && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm z-10 p-6 text-center">
            <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 max-w-lg shadow-2xl">
              <svg className="w-12 h-12 text-blue-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h2 className="text-xl font-bold text-white mb-2">Chưa cấu hình Dashboard</h2>
              <p className="text-slate-300 text-sm mb-6">
                Vui lòng cấu hình biến môi trường <code className="bg-slate-900 text-blue-300 px-2 py-1 rounded">NEXT_PUBLIC_POSTHOG_SHARED_DASHBOARD_URL</code> với link Shared Dashboard từ PostHog để hiển thị biểu đồ tại đây.
              </p>
              <a
                href="https://posthog.com/docs/dashboards/sharing"
                target="_blank"
                rel="noreferrer"
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
              >
                Xem hướng dẫn PostHog
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
