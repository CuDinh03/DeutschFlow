import '@/styles/galerie.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import { GUIDE_ARTICLES } from '@/data/camNang'
import { absoluteUrl } from '@/lib/siteUrl'
import { ogImage } from '@/lib/ogImage'
import { breadcrumbStructuredData, toJsonLd } from '@/lib/homeStructuredData'
import { LandingHeader } from '@/components/landing-v2/LandingHeader'
import { LandingFooter } from '@/components/landing-v2/LandingFooter'

/** Mục lục Cẩm nang `/cam-nang/` (đợt D, 08/11/2026) — chỉ tiếng Việt. */
const TITLE = 'Cẩm nang phỏng vấn và luyện thi tiếng Đức · myDeutschFlow'
const DESCRIPTION = 'Cẩm nang phỏng vấn xin việc bằng tiếng Đức theo từng nghề: câu hỏi thật, cách trả lời, từ vựng và lỗi hay gặp.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl('/cam-nang/') },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    locale: 'vi_VN',
    url: absoluteUrl('/cam-nang/'),
    siteName: 'myDeutschFlow',
    images: [ogImage('home', 'vi', TITLE)],
  },
}

export default function GuideIndexPage() {
  return (
    <div className="ga-scope min-h-screen overflow-x-clip bg-ga-bg font-ga-ui text-ga-ink">
      <LandingHeader current="guide" showLanguage={false} />
      <main className="mx-auto max-w-[1240px] px-5 pb-16 pt-10 sm:px-8 md:pt-14 lg:px-[60px]">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(breadcrumbStructuredData([['Trang chủ', '/'], ['Cẩm nang', '/cam-nang/']])) }} />
        <div className="mb-[22px] inline-flex items-center gap-2 text-ga-eyebrow uppercase text-ga-muted">
          <span className="inline-block h-[7px] w-[7px] shrink-0 bg-ga-yellow" />Cẩm nang
        </div>
        <h1 className="max-w-[820px] font-ga-display text-ga-h1-m font-medium leading-[1.08] sm:text-ga-h1">
          Cẩm nang phỏng vấn tiếng Đức theo nghề
        </h1>
        <p className="mt-5 max-w-[640px] text-ga-body-lg text-ga-muted">{DESCRIPTION}</p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDE_ARTICLES.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/cam-nang/${a.slug}/`}
                className="group flex h-full flex-col border border-ga-border bg-ga-card p-5 transition-colors hover:border-ga-ink sm:p-6"
              >
                {a.occupationNameDe ? <span className="text-ga-eyebrow uppercase text-ga-muted" lang="de">{a.occupationNameDe}</span> : <span className="text-ga-eyebrow uppercase text-ga-muted">{a.topic}</span>}
                <span className="mt-2 text-ga-h3 text-ga-ink">{a.h1}</span>
                <span className="mt-2 flex-1 text-ga-small text-ga-muted">{a.description}</span>
                <span className="mt-4 text-ga-small font-semibold text-ga-ink underline decoration-ga-yellow decoration-2 underline-offset-4 group-hover:decoration-ga-ink">
                  Đọc bài
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <LandingFooter />
    </div>
  )
}
