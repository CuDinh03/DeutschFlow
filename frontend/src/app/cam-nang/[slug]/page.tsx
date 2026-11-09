import '@/styles/galerie.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { GUIDE_ARTICLES, guideArticle, guideDocumentTitle } from '@/data/camNang'
import { absoluteUrl } from '@/lib/siteUrl'
import { occupationOgImage } from '@/lib/ogImage'
import { GaBtn } from '@/components/ui-v2/GaBtn'
import { LandingHeader } from '@/components/landing-v2/LandingHeader'
import { LandingFooter } from '@/components/landing-v2/LandingFooter'
import { START_HREF } from '@/components/landing-v2/links'

/**
 * Bài Cẩm nang `/cam-nang/[slug]/` (đợt D, 08/11/2026) — chỉ tiếng Việt, nội dung ở `data/camNang.ts`.
 * Article + FAQPage JSON-LD; dẫn sang trang nghề và mở buổi luyện đúng nghề.
 */
export const dynamicParams = false

export function generateStaticParams() {
  return GUIDE_ARTICLES.map((a) => ({ slug: a.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const a = guideArticle(params.slug)
  if (!a) return {}
  const url = absoluteUrl(`/cam-nang/${a.slug}/`)
  return {
    // Root layout không có template tiêu đề — tự gắn tên thương hiệu như trang mục lục Cẩm nang.
    title: guideDocumentTitle(a.title),
    description: a.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title: a.title,
      description: a.description,
      locale: 'vi_VN',
      url,
      siteName: 'myDeutschFlow',
      // Ảnh trang nghề: tên nghề + câu hỏi đã duyệt (A3).
      images: [occupationOgImage(a.occupationCode, 'vi', a.title)],
    },
  }
}

const YellowSq = () => <span className="inline-block h-[7px] w-[7px] shrink-0 bg-ga-yellow" />
const H2 = 'mb-5 mt-14 font-ga-display text-ga-h2 font-medium text-ga-ink sm:text-[32px]'

export default function GuidePage({ params }: { params: { slug: string } }) {
  const a = guideArticle(params.slug)
  if (!a) notFound()
  const url = absoluteUrl(`/cam-nang/${a.slug}/`)
  const startHref = `${START_HREF}/?occupation=${encodeURIComponent(a.occupationCode)}`

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: a.h1,
        description: a.description,
        inLanguage: 'vi-VN',
        datePublished: a.published,
        dateModified: a.published,
        mainEntityOfPage: url,
        // Google đòi `image` cho Article; dùng chính ảnh chia sẻ của trang (URL tuyệt đối).
        image: absoluteUrl(occupationOgImage(a.occupationCode, 'vi', a.title).url),
        author: { '@type': 'Organization', name: 'myDeutschFlow', url: absoluteUrl('/') },
        publisher: { '@type': 'Organization', name: 'myDeutschFlow', logo: { '@type': 'ImageObject', url: absoluteUrl('/icon-512.png') } },
      },
      {
        '@type': 'FAQPage',
        mainEntity: a.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
    ],
  }

  return (
    <div className="ga-scope min-h-screen overflow-x-clip bg-ga-bg font-ga-ui text-ga-ink">
      <LandingHeader current="guide" showLanguage={false} />
      <main className="mx-auto max-w-[860px] px-5 pb-16 pt-10 sm:px-8 md:pt-14">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
        <nav aria-label="Đường dẫn" className="mb-6 text-ga-small text-ga-muted">
          <Link href="/cam-nang/" className="underline underline-offset-4 hover:text-ga-ink">Cẩm nang</Link>
          <span aria-hidden> / </span>
          <span>Nghề bếp</span>
        </nav>
        <article>
          <div className="mb-[18px] inline-flex items-center gap-2 text-ga-eyebrow uppercase text-ga-muted">
            <YellowSq />Cẩm nang phỏng vấn · <span lang="de">{a.occupationNameDe}</span>
          </div>
          <h1 className="font-ga-display text-ga-h1-m font-medium leading-[1.1] sm:text-ga-h1">{a.h1}</h1>
          <p className="mt-5 text-ga-body-lg text-ga-muted">{a.lead}</p>
          <p className="mt-3 text-ga-small text-ga-muted">
            Cập nhật <time dateTime={a.published}>{a.published.split('-').reverse().join('/')}</time>
          </p>

          <p className="mt-10 text-ga-body-lg text-ga-ink">{a.intro}</p>

          <h2 className={H2}>Ba câu hỏi tiêu biểu trong buổi luyện với {a.interviewer}</h2>
          <ol className="flex flex-col gap-8">
            {a.questions.map((q, i) => (
              <li key={q.de} className="border-l-2 border-ga-yellow pl-5">
                <div className="text-ga-eyebrow uppercase text-ga-muted">Câu {i + 1}</div>
                <p lang="de" className="mt-2 font-ga-display text-ga-body-lg italic text-ga-ink">„{q.de}“</p>
                <p className="mt-1 text-ga-body text-ga-muted">{q.vi}</p>
                <p className="mt-4 text-ga-body text-ga-ink"><strong className="font-semibold">Cách trả lời:</strong> {q.tip}</p>
                <div className="mt-3 border border-ga-border bg-ga-card p-4">
                  <div className="mb-1 text-ga-caption text-ga-muted">Câu trả lời mẫu (minh hoạ)</div>
                  <p lang="de" className="text-ga-body text-ga-ink">{q.sample}</p>
                </div>
              </li>
            ))}
          </ol>

          <h2 className={H2}>Từ vựng trong bếp nên thuộc</h2>
          <dl className="grid gap-x-8 border-t border-ga-border sm:grid-cols-2">
            {a.vocab.map((v) => (
              <div key={v.de} className="border-b border-ga-border py-3">
                <dt lang="de" className="text-ga-body font-semibold text-ga-ink">{v.de}</dt>
                <dd className="text-ga-small text-ga-muted">{v.vi}</dd>
              </div>
            ))}
          </dl>

          <h2 className={H2}>Lỗi ngữ pháp người Việt hay gặp</h2>
          <ul className="flex flex-col gap-5">
            {a.mistakes.map((m) => (
              <li key={m.wrong} className="border border-ga-border bg-ga-card p-4 sm:p-5">
                <p lang="de" className="text-ga-body text-ga-muted line-through decoration-ga-red">{m.wrong}</p>
                <p lang="de" className="mt-1 text-ga-body font-semibold text-ga-ink">{m.right}</p>
                <p className="mt-2 text-ga-small text-ga-muted">{m.why}</p>
              </li>
            ))}
          </ul>

          <h2 className={H2}>Luyện với {a.interviewer} trên myDeutschFlow</h2>
          <p className="text-ga-body-lg text-ga-ink">{a.practice}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <GaBtn asChild variant="ink" size="lg" className="w-full sm:w-auto">
              <Link href={startHref}><YellowSq />Luyện thử miễn phí</Link>
            </GaBtn>
            <GaBtn asChild variant="ghost" size="lg" className="w-full sm:w-auto">
              <Link href={`/phong-van/${a.occupationCode}/`}>Xem trang nghề {a.occupationNameDe}</Link>
            </GaBtn>
          </div>

          <h2 className={H2}>Câu hỏi thường gặp</h2>
          <div className="border-t border-ga-border">
            {a.faqs.map((f) => (
              <div key={f.q} className="border-b border-ga-border py-4">
                <h3 className="text-ga-h3 text-ga-ink">{f.q}</h3>
                <p className="mt-2 text-ga-body text-ga-muted">{f.a}</p>
              </div>
            ))}
          </div>
        </article>
      </main>
      <LandingFooter />
    </div>
  )
}
