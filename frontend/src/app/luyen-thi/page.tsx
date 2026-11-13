import '@/styles/galerie.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import { GERMAN_EXAMS } from '@/data/germanExams'
import { absoluteUrl } from '@/lib/siteUrl'
import { ogImage } from '@/lib/ogImage'
import { GaBtn } from '@/components/ui-v2/GaBtn'
import { LandingHeader } from '@/components/landing-v2/LandingHeader'
import { LandingFooter } from '@/components/landing-v2/LandingFooter'
import { START_HREF } from '@/components/landing-v2/links'

/**
 * Trang tổng luyện thi `/luyen-thi/` (chỉ tiếng Việt). Đợt C kế hoạch cải thiện trang chủ (08/11/2026):
 * chuyển sang hệ Galerie, dùng header/footer chung của trang công khai (ẩn nút đổi ngôn ngữ vì trang
 * chưa có bản en/de), title chứa cụm "thi thử telc B1 online" (14/11/2026: chỉ telc B1 có thi thử thật — owner chốt). Nội dung các kỳ thi giữ nguyên.
 */
const TITLE = 'Thi thử telc B1 online, cấu trúc đề Goethe · myDeutschFlow'
const DESCRIPTION =
  'Hướng dẫn luyện thi tiếng Đức Goethe và telc (A2, B1, B2, Pflege): cấu trúc đề, cách tính điểm, checklist sẵn-sàng-thi theo kỹ năng. Chấm thử bài viết bằng AI miễn phí.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl('/luyen-thi/') },
  robots: { index: true, follow: true },
  // A3 (08/11/2026): khai openGraph riêng — trước đây kế thừa og:title của trang chủ từ layout.
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    locale: 'vi_VN',
    url: absoluteUrl('/luyen-thi/'),
    siteName: 'myDeutschFlow',
    images: [ogImage('luyen-thi', 'vi', TITLE)],
  },
}

const YellowSq = ({ dark = false }: { dark?: boolean }) => (
  <span className={`inline-block h-[7px] w-[7px] shrink-0 ${dark ? 'bg-ga-ink' : 'bg-ga-yellow'}`} />
)

export default function ExamHubPage() {
  const byProvider = {
    Goethe: GERMAN_EXAMS.filter((e) => e.provider === 'Goethe'),
    telc: GERMAN_EXAMS.filter((e) => e.provider === 'telc'),
  }

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: GERMAN_EXAMS.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: e.name,
      url: absoluteUrl(`/luyen-thi/${e.slug}/`),
    })),
  }

  return (
    <div className="ga-scope min-h-screen overflow-x-clip bg-ga-bg font-ga-ui text-ga-ink">
      <LandingHeader current="exam" showLanguage={false} />
      <main className="mx-auto max-w-[1240px] px-5 pb-16 pt-10 sm:px-8 md:pt-14 lg:px-[60px]">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />

        <div className="mb-[22px] inline-flex items-center gap-2 text-ga-eyebrow uppercase text-ga-muted">
          <YellowSq />Luyện thi
        </div>
        <h1 className="max-w-[860px] font-ga-display text-ga-h1-m font-medium leading-[1.08] sm:text-ga-h1">
          Luyện thi tiếng Đức Goethe và telc
        </h1>
        <p className="mt-5 max-w-[680px] text-ga-body-lg text-ga-muted">
          Cấu trúc đề, cách tính điểm và checklist sẵn sàng thi cho các kỳ thi Goethe và telc. Thi thử telc B1
          online ngay trên myDeutschFlow, đúng thời gian và cấu trúc đề. Chọn kỳ thi của bạn bên dưới.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <GaBtn asChild variant="ink" size="lg" className="w-full sm:w-auto">
            <Link href={START_HREF}><YellowSq />Học thử miễn phí</Link>
          </GaBtn>
          <GaBtn asChild variant="ghost" size="lg" className="w-full sm:w-auto">
            <Link href="/free-grade/">Chấm thử bài viết B1 miễn phí</Link>
          </GaBtn>
        </div>
        <p className="mt-4 flex items-start gap-2.5 text-ga-small text-ga-muted">
          <span className="mt-[7px] inline-block h-[7px] w-[7px] shrink-0 bg-ga-yellow" />
          Thi thử trên myDeutschFlow hiện có cho telc B1 (mô phỏng theo format). Các trang Goethe là hướng dẫn cấu trúc đề. myDeutschFlow không liên kết với Goethe-Institut hay telc.
        </p>

        <div className="mt-14 flex flex-col gap-12">
          {(['Goethe', 'telc'] as const).map((provider) => (
            <section key={provider} aria-labelledby={`exam-${provider}`}>
              <h2 id={`exam-${provider}`} className="mb-5 border-b border-ga-border pb-3 text-ga-h2 text-ga-ink">
                Kỳ thi {provider}
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {byProvider[provider].map((e) => (
                  <li key={e.slug}>
                    <Link
                      href={`/luyen-thi/${e.slug}`}
                      className="group flex h-full flex-col border border-ga-border bg-ga-card p-5 transition-colors hover:border-ga-ink sm:p-6"
                    >
                      <span className="text-ga-eyebrow uppercase text-ga-muted">{e.provider} · {e.level}</span>
                      <span className="mt-2 text-ga-h3 text-ga-ink">{e.name}</span>
                      <span className="mt-1 flex-1 text-ga-small text-ga-muted">{e.tagline}</span>
                      <span className="mt-4 text-ga-small font-semibold text-ga-ink underline decoration-ga-yellow decoration-2 underline-offset-4 group-hover:decoration-ga-ink">
                        Xem hướng dẫn
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
      <LandingFooter />
    </div>
  )
}
