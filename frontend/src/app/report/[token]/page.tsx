import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BadgeCheck, PenLine, Sparkles } from 'lucide-react'
import type { GradeReport } from '@/lib/marketingApi'
import { ShareButtons } from '@/components/marketing/ShareButtons'

const backendOrigin = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '')
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://mydeutschflow.com').replace(/\/+$/, '')

async function fetchReport(token: string): Promise<GradeReport | null> {
  try {
    const res = await fetch(`${backendOrigin}/api/public/grade-report/${encodeURIComponent(token)}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as GradeReport
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const report = await fetchReport(params.token)
  const url = `${SITE_URL}/report/${params.token}/`
  if (!report) {
    return { title: 'Báo cáo chấm bài | DeutschFlow', robots: { index: false, follow: false } }
  }
  const title = `Bài viết tiếng Đức được ${report.score}/100 — Chấm bởi DeutschFlow`
  const description = 'Báo cáo chấm bài tiếng Đức bằng AI: điểm số + nhận xét chi tiết. Chấm thử bài của bạn miễn phí.'
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'article' },
    // Báo cáo cá nhân — không cần Google index, nhưng cho phép xem/chia sẻ tự do.
    robots: { index: false, follow: true },
  }
}

export default async function GradeReportPage({ params }: { params: { token: string } }) {
  const report = await fetchReport(params.token)
  if (!report) notFound()

  const shareUrl = `${SITE_URL}/report/${params.token}/`
  const tone =
    report.score >= 80 ? 'from-emerald-500 to-teal-600' :
    report.score >= 60 ? 'from-indigo-500 to-violet-600' :
    'from-amber-500 to-orange-600'

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-2xl px-5 py-10">
        {/* Branded header (watermark) */}
        <div className="mb-6 flex items-center justify-center gap-2 text-slate-400">
          <BadgeCheck size={18} className="text-indigo-500" />
          <span className="text-sm font-bold uppercase tracking-widest">Chấm bởi DeutschFlow</span>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {/* Score */}
          <div className={`bg-gradient-to-br ${tone} p-8 text-center text-white`}>
            <p className="text-xs font-bold uppercase tracking-widest text-white/80">Điểm AI chấm</p>
            <p className="mt-1 text-7xl font-black leading-none">
              {report.score}<span className="text-2xl font-bold text-white/70">/100</span>
            </p>
            {report.topic && <p className="mt-3 text-sm font-medium text-white/90">Chủ đề: {report.topic}</p>}
          </div>

          {/* Feedback */}
          <div className="p-6 sm:p-8">
            <p className="text-sm font-bold uppercase tracking-wider text-slate-500">Nhận xét</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{report.feedback}</p>

            <div className="mt-6 border-t border-slate-100 pt-6">
              <p className="mb-3 text-sm font-semibold text-slate-700">Chia sẻ kết quả</p>
              <ShareButtons url={shareUrl} score={report.score} />
            </div>
          </div>
        </div>

        {/* CTA — viral funnel back into the lead magnet */}
        <div className="mt-6 rounded-3xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-white p-6 text-center shadow-sm">
          <div className="mb-3 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
              <PenLine size={24} />
            </div>
          </div>
          <h2 className="text-lg font-black text-slate-800">Bài viết tiếng Đức của bạn được mấy điểm?</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Dán bài Schreiben — AI chấm điểm + nhận xét trong ~15 giây, miễn phí.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link href="/free-grade" className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700">
              <Sparkles size={16} /> Chấm bài của bạn miễn phí
            </Link>
            <Link href="/register" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
              Luyện thi với DeutschFlow
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Báo cáo được tạo bằng AI trên DeutschFlow — nền tảng luyện thi tiếng Đức Goethe/telc.
        </p>
      </div>
    </main>
  )
}
