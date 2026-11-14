import '@/styles/galerie.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { GradeReport } from '@/lib/marketingApi'
import { ShareButtons } from '@/components/marketing/ShareButtons'
import { GradeScore } from '@/components/marketing/GradeScore'
import { GaBtn } from '@/components/ui-v2/GaBtn'
import { GaGlyphMark } from '@/components/ui-v2/GaGlyphMark'
import { LandingHeader } from '@/components/landing-v2/LandingHeader'
import { LandingFooter } from '@/components/landing-v2/LandingFooter'
import { START_HREF } from '@/components/landing-v2/links'
import { serverBackendFetch } from '@/lib/serverBackend'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://mydeutschflow.com').replace(/\/+$/, '')

async function fetchReport(token: string): Promise<GradeReport | null> {
  try {
    const res = await serverBackendFetch(`/api/public/grade-report/${encodeURIComponent(token)}`, {
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
    return { title: 'Báo cáo chấm bài | myDeutschFlow', robots: { index: false, follow: false } }
  }
  const title = `Bài viết tiếng Đức được ${report.score}/100 · myDeutschFlow chấm thử`
  const description = 'Báo cáo chấm bài tiếng Đức bằng AI: điểm số và nhận xét chi tiết. Chấm thử bài của bạn miễn phí.'
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'article' },
    robots: { index: false, follow: true },
  }
}

export default async function GradeReportPage({ params }: { params: { token: string } }) {
  const report = await fetchReport(params.token)
  if (!report) notFound()

  const shareUrl = `${SITE_URL}/report/${params.token}/`

  return (
    <div className="ga-scope ga-public min-h-screen overflow-x-clip bg-ga-bg font-ga-ui text-ga-ink">
      <LandingHeader current="exam" showLanguage={false} />
      <main className="mx-auto max-w-2xl px-5 pb-20 pt-8 sm:px-8 md:pt-14">
        <p className="mb-5 text-center text-ga-eyebrow uppercase text-ga-muted">Chấm thử bởi myDeutschFlow</p>

        <div className="overflow-hidden rounded-ga-lg shadow-ga-md">
          <GradeScore score={report.score} topic={report.topic} center />

          <div className="rounded-b-ga-lg border-x border-b border-ga-border-strong bg-ga-card p-6 sm:p-8">
            <p className="text-ga-eyebrow uppercase text-ga-red">Nhận xét</p>
            <p className="mt-2 whitespace-pre-line text-ga-body text-ga-ink">{report.feedback}</p>

            <div className="mt-6 border-t border-ga-border pt-6">
              <p className="mb-3 text-ga-small font-semibold text-ga-ink">Chia sẻ kết quả</p>
              <ShareButtons url={shareUrl} score={report.score} />
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center rounded-ga-xl border border-ga-border-strong bg-ga-card p-6 text-center shadow-ga-sm">
          <GaGlyphMark name="viet" size={40} className="mb-3 block text-ga-ink" />
          <h2 className="font-ga-display text-ga-h2 font-medium text-ga-ink">Bài viết tiếng Đức của bạn được mấy điểm?</h2>
          <p className="mx-auto mt-1.5 max-w-md text-ga-small text-ga-muted">
            Dán bài viết tiếng Đức, AI chấm theo thang 100 và nhận xét ngữ pháp, từ vựng, nội dung, bố cục.
          </p>
          <div className="mt-5 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <GaBtn asChild variant="yellow" size="lg" className="ga-btn-gleam">
              <Link href="/free-grade/">Chấm bài của bạn miễn phí</Link>
            </GaBtn>
            <GaBtn asChild variant="ghost" size="lg">
              <Link href={START_HREF}>Học thử 7 ngày Pro</Link>
            </GaBtn>
          </div>
        </div>

        <p className="mt-6 text-center text-ga-caption text-ga-muted">
          Báo cáo được tạo bằng AI trên myDeutschFlow, điểm chỉ để tham khảo, không liên kết với Goethe-Institut hay telc.
        </p>
      </main>
      <LandingFooter />
    </div>
  )
}
