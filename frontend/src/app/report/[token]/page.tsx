import '@/styles/galerie.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PenLine, Sparkles } from 'lucide-react'
import type { GradeReport } from '@/lib/marketingApi'
import { ShareButtons } from '@/components/marketing/ShareButtons'
import { GradeScore } from '@/components/marketing/GradeScore'
import { GaBtn } from '@/components/ui-v2/GaBtn'
import { GaGlyph } from '@/components/ui-v2/GaGlyph'
import { LandingHeader } from '@/components/landing-v2/LandingHeader'
import { LandingFooter } from '@/components/landing-v2/LandingFooter'
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
  const title = `Bài viết tiếng Đức được ${report.score}/100 — Chấm bởi myDeutschFlow`
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

/** Icon đợt B (09/11/2026): trang báo cáo chia sẻ chuyển sang Galerie — header/footer công khai, token `ga-*`. */
export default async function GradeReportPage({ params }: { params: { token: string } }) {
  const report = await fetchReport(params.token)
  if (!report) notFound()

  const shareUrl = `${SITE_URL}/report/${params.token}/`

  return (
    <div className="ga-scope min-h-screen overflow-x-clip bg-ga-bg font-ga-ui text-ga-ink">
      <LandingHeader current="exam" showLanguage={false} />
      <main className="mx-auto max-w-2xl px-5 pb-16 pt-10 sm:px-8 md:pt-14">
        {/* Dấu "chấm bởi" (watermark) — chữ trơn kiểu eyebrow, không icon (ICON_WEB §2). */}
        <p className="mb-6 text-center text-ga-eyebrow uppercase text-ga-muted">Chấm bởi myDeutschFlow</p>

        <GradeScore score={report.score} topic={report.topic} center />

        <div className="border-x border-b border-ga-border bg-ga-card p-6 sm:p-8">
          <p className="text-ga-eyebrow uppercase text-ga-muted">Nhận xét</p>
          <p className="mt-2 whitespace-pre-line text-ga-body text-ga-ink">{report.feedback}</p>

          <div className="mt-6 border-t border-ga-border pt-6">
            <p className="mb-3 text-ga-small font-semibold text-ga-ink">Chia sẻ kết quả</p>
            <ShareButtons url={shareUrl} score={report.score} />
          </div>
        </div>

        {/* CTA — vòng lan truyền quay về trang chấm thử */}
        <div className="mt-6 flex flex-col items-center border border-ga-border bg-ga-card p-6 text-center">
          <GaGlyph icon={PenLine} size="lg" className="mb-3" />
          <h2 className="font-ga-display text-ga-h2 font-medium text-ga-ink">Bài viết tiếng Đức của bạn được mấy điểm?</h2>
          <p className="mx-auto mt-1 max-w-md text-ga-small text-ga-muted">
            Dán bài Schreiben — AI chấm điểm + nhận xét trong ~15 giây, miễn phí.
          </p>
          <div className="mt-4 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <GaBtn asChild variant="ink" size="lg">
              <Link href="/free-grade/"><Sparkles size={16} aria-hidden /> Chấm bài của bạn miễn phí</Link>
            </GaBtn>
            <GaBtn asChild variant="ghost" size="lg">
              <Link href="/v2/register">Luyện thi với DeutschFlow</Link>
            </GaBtn>
          </div>
        </div>

        <p className="mt-6 text-center text-ga-caption text-ga-muted">
          Báo cáo được tạo bằng AI trên DeutschFlow — nền tảng luyện thi tiếng Đức Goethe/telc.
        </p>
      </main>
      <LandingFooter />
    </div>
  )
}
