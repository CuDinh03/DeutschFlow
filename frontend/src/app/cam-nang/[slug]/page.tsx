import '@/styles/galerie.css'
import type { Metadata } from 'next'
import { breadcrumbStructuredData } from '@/lib/homeStructuredData'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { GUIDE_ARTICLES, guideArticle, guideDocumentTitle } from '@/data/camNang'
import { absoluteUrl } from '@/lib/siteUrl'
import { occupationOgImage } from '@/lib/ogImage'
import { GaBtn } from '@/components/ui-v2/GaBtn'
import { PublicShell } from '@/components/landing-v2/PublicShell'
import { PersonaPortrait } from '@/components/landing-v2/PersonaPortrait'
import { START_HREF } from '@/components/landing-v2/links'
import { GuideVocabDeck } from '@/components/marketing/GuideVocabDeck'

/**
 * Bài Cẩm nang `/cam-nang/[slug]/` (đợt D, 08/11/2026) — chỉ tiếng Việt, nội dung ở `data/camNang.ts`.
 * Nâng cấp ấn phẩm biên tập 68ch v3.4: mục lục sticky trên màn rộng + `<details>` trên điện thoại,
 * `.dropcap` mở bài, thẻ câu hỏi mẫu `.briefpapier`, bộ từ vựng tương tác `der/die/das` và chấm đối chiếu lỗi.
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
      images: [occupationOgImage(a.occupationCode, 'vi', a.title)],
    },
  }
}

const H2 = 'mb-5 mt-12 scroll-mt-24 font-ga-display text-ga-m-h2-m font-medium text-ga-ink sm:text-ga-m-h2-t'

export default function GuidePage({ params }: { params: { slug: string } }) {
  const a = guideArticle(params.slug)
  if (!a) notFound()
  const url = absoluteUrl(`/cam-nang/${a.slug}/`)
  const startHref = `${START_HREF}/?occupation=${encodeURIComponent(a.occupationCode)}`

  const tocItems = [
    { href: '#cau-hoi', label: `Ba câu hỏi với ${a.interviewer}` },
    { href: '#tu-vung', label: a.vocabTitle },
    { href: '#loi-ngu-phap', label: 'Lỗi ngữ pháp hay gặp' },
    { href: '#luyen-thu', label: `Luyện nói với ${a.interviewer}` },
    { href: '#faq', label: 'Câu hỏi thường gặp' },
  ]

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
        image: absoluteUrl(occupationOgImage(a.occupationCode, 'vi', a.title).url),
        author: { '@type': 'Organization', name: 'myDeutschFlow', url: absoluteUrl('/') },
        publisher: {
          '@type': 'Organization',
          name: 'myDeutschFlow',
          logo: { '@type': 'ImageObject', url: absoluteUrl('/icon-512.png') },
        },
      },
      {
        ...breadcrumbStructuredData([
          ['Trang chủ', '/'],
          ['Cẩm nang', '/cam-nang/'],
          [a.h1, `/cam-nang/${a.slug}/`],
        ]),
        '@context': undefined,
      },
      {
        '@type': 'FAQPage',
        mainEntity: a.faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  }

  return (
    <PublicShell
      current="guide"
      showLanguage={false}
      stickyCta="b2c"
      mainClassName="mx-auto w-full max-w-[1140px] px-5 pb-24 pt-8 sm:px-8 md:pt-12"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }}
      />

      <nav aria-label="Đường dẫn" className="mb-6 flex flex-wrap items-center gap-1.5 text-ga-small text-ga-muted">
        <Link href="/" className="underline underline-offset-4 hover:text-ga-ink">
          Trang chủ
        </Link>
        <span aria-hidden>/</span>
        <Link href="/cam-nang/" className="underline underline-offset-4 hover:text-ga-ink">
          Cẩm nang
        </Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-ga-ink">{a.crumb}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,68ch)_260px] lg:items-start lg:justify-between lg:gap-12">
        <article className="min-w-0">
          <header className="rounded-ga-xl border border-ga-border bg-ga-card p-6 shadow-ga-sm sm:p-8">
            <div className="mb-4 inline-flex flex-wrap items-center gap-2 rounded-ga-pill border border-ga-border bg-ga-bg px-3.5 py-1 text-ga-eyebrow uppercase text-ga-muted">
              <span className="inline-block h-2 w-2 shrink-0 rounded-ga-pill bg-ga-yellow" />
              <span>Cẩm nang phỏng vấn</span>
              <span aria-hidden>·</span>
              <span lang="de" className="text-ga-ink">{a.occupationNameDe}</span>
            </div>
            <h1 className="font-ga-display text-ga-m-h1-m font-medium text-ga-ink sm:text-ga-m-h1-art">{a.h1}</h1>
            <p className="mt-4 text-ga-m-lead text-ga-muted">{a.lead}</p>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ga-border pt-4 text-ga-small text-ga-muted">
              <span>
                Cập nhật <time dateTime={a.published}>{a.published.split('-').reverse().join('/')}</time> · Người phỏng vấn:{' '}
                <strong className="font-semibold text-ga-ink">{a.interviewer}</strong>
              </span>
              <Link
                href={`/phong-van/${a.occupationCode}/`}
                className="font-semibold text-ga-navy underline decoration-ga-yellow decoration-2 underline-offset-4 hover:text-ga-ink"
              >
                Trang nghề {a.occupationNameDe} →
              </Link>
            </div>
          </header>

          {/* Mục lục thu gọn trên điện thoại / máy tính bảng */}
          <details className="mt-5 rounded-ga-lg border border-ga-border bg-ga-card p-4 lg:hidden">
            <summary className="cursor-pointer text-ga-small font-semibold text-ga-ink">
              Mục lục bài viết ({tocItems.length} phần)
            </summary>
            <ol className="mt-3 flex flex-col gap-2 border-t border-ga-border pt-3 text-ga-small">
              {tocItems.map((item, idx) => (
                <li key={item.href}>
                  <a href={item.href} className="text-ga-muted hover:text-ga-ink">
                    {idx + 1}. {item.label}
                  </a>
                </li>
              ))}
            </ol>
          </details>

          <p className="dropcap mt-8 text-ga-m-prose text-ga-ink">{a.intro}</p>

          <h2 id="cau-hoi" className={H2}>
            Ba câu hỏi tiêu biểu trong buổi luyện với {a.interviewer}
          </h2>
          <ol className="flex flex-col gap-6">
            {a.questions.map((q, i) => (
              <li
                key={q.de}
                className="rounded-ga-xl border border-ga-border bg-ga-card p-5 shadow-ga-sm sm:p-6"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 rounded-ga-pill bg-ga-yellow-soft px-3 py-1 text-ga-eyebrow uppercase text-ga-ink">
                    Câu {i + 1} · Đã duyệt
                  </span>
                  <span className="text-ga-caption text-ga-muted" lang="de">
                    {a.interviewer} · {a.occupationNameDe}
                  </span>
                </div>
                <p lang="de" className="mt-3 font-ga-display text-ga-m-h3 italic text-ga-ink">
                  „{q.de}“
                </p>
                <p className="mt-1.5 text-ga-body text-ga-muted">{q.vi}</p>
                <div className="mt-4 rounded-ga-md border-l-4 border-ga-yellow bg-ga-bg p-4 text-ga-body text-ga-ink">
                  <strong className="font-semibold">Cách trả lời:</strong> {q.tip}
                </div>
                <div className="briefpapier mt-4 rounded-ga-md border border-ga-border p-4">
                  <div className="mb-1 text-ga-eyebrow uppercase text-ga-muted">
                    Câu trả lời mẫu (minh hoạ — không phải đáp án duy nhất)
                  </div>
                  <p lang="de" className="text-ga-m-prose font-medium text-ga-ink">
                    „{q.sample}“
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <h2 id="tu-vung" className={H2}>
            {a.vocabTitle}
          </h2>
          <GuideVocabDeck items={a.vocab} />

          <h2 id="loi-ngu-phap" className={H2}>
            Lỗi ngữ pháp người Việt hay gặp
          </h2>
          <ul className="flex flex-col gap-4">
            {a.mistakes.map((m) => (
              <li
                key={m.wrong}
                className="rounded-ga-lg border border-ga-border bg-ga-card p-5 shadow-ga-sm"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-ga-md border border-ga-border bg-ga-red-soft p-3.5">
                    <span className="text-ga-eyebrow uppercase text-ga-red">Hay nói nhầm</span>
                    <p lang="de" className="mt-1 text-ga-body text-ga-muted line-through decoration-ga-red">
                      {m.wrong}
                    </p>
                  </div>
                  <div className="rounded-ga-md border border-ga-border bg-ga-green-soft p-3.5">
                    <span className="text-ga-eyebrow uppercase text-ga-green">Nên nói</span>
                    <p lang="de" className="mt-1 text-ga-body font-semibold text-ga-ink">
                      {m.right}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-ga-small text-ga-muted">
                  <strong className="font-semibold text-ga-ink">Lý do:</strong> {m.why}
                </p>
              </li>
            ))}
          </ul>

          <section
            id="luyen-thu"
            className="mt-12 scroll-mt-24 rounded-ga-xl border border-ga-ink bg-ga-ink p-6 text-ga-bg shadow-ga-md sm:p-8"
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              {a.occupationCode === 'koch' && (
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-ga-lg border-2 border-ga-yellow bg-ga-card">
                  <PersonaPortrait id="klaus" />
                </div>
              )}
              <div>
                <span className="text-ga-eyebrow uppercase text-ga-yellow">Vào buổi phỏng vấn mô phỏng</span>
                <h2 className="mt-1 font-ga-display text-ga-m-h2-m font-medium text-ga-bg sm:text-ga-m-h2-t">
                  Luyện với {a.interviewer} trên myDeutschFlow
                </h2>
              </div>
            </div>
            <p className="mt-4 text-ga-m-prose text-ga-bg/85">{a.practice}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <GaBtn asChild variant="yellow" size="lg" className="ga-btn-gleam w-full sm:w-auto">
                <Link href={startHref}>
                  Học thử miễn phí
                  <ArrowRight size={16} aria-hidden />
                </Link>
              </GaBtn>
              <GaBtn
                asChild
                variant="ghost"
                size="lg"
                className="w-full border-ga-bg/30 bg-transparent text-ga-bg hover:border-ga-yellow hover:bg-ga-bg/10 sm:w-auto"
              >
                <Link href={`/phong-van/${a.occupationCode}/`}>Xem trang nghề {a.occupationNameDe}</Link>
              </GaBtn>
            </div>
          </section>

          <h2 id="faq" className={H2}>
            Câu hỏi thường gặp
          </h2>
          <div className="flex flex-col gap-3">
            {a.faqs.map((f, idx) => (
              <details
                key={f.q}
                open={idx === 0}
                className="group rounded-ga-lg border border-ga-border bg-ga-card p-5 shadow-ga-sm"
              >
                <summary className="cursor-pointer list-none font-semibold text-ga-ink">
                  <span className="flex items-center justify-between gap-3">
                    <span>{f.q}</span>
                    <span aria-hidden className="text-ga-muted transition-transform group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-3 border-t border-ga-border pt-3 text-ga-body text-ga-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </article>

        {/* Cột mục lục sticky trên màn hình rộng */}
        <aside aria-label="Mục lục bài viết" className="hidden lg:sticky lg:top-24 lg:flex lg:flex-col lg:gap-4">
          <div className="rounded-ga-xl border border-ga-border bg-ga-card p-5 shadow-ga-sm">
            <p className="text-ga-eyebrow uppercase text-ga-muted">Trong bài này</p>
            <ol className="mt-3 flex flex-col gap-2.5 text-ga-small">
              {tocItems.map((item, idx) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="block text-ga-muted transition-colors hover:font-semibold hover:text-ga-ink"
                  >
                    {idx + 1}. {item.label}
                  </a>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-ga-xl border border-ga-yellow bg-ga-yellow-soft p-5">
            <p className="text-ga-eyebrow uppercase text-ga-ink">Nói thử ngay</p>
            <p className="mt-1.5 font-ga-display text-ga-m-h3 font-medium text-ga-ink">
              Trả lời {a.interviewer} bằng giọng nói
            </p>
            <p className="mt-2 text-ga-small text-ga-muted">
              7 ngày Pro khi đăng ký, không cần thanh toán trước.
            </p>
            <GaBtn asChild variant="ink" size="md" className="mt-4 w-full">
              <Link href={startHref}>Mở buổi luyện {a.crumb}</Link>
            </GaBtn>
          </div>
        </aside>
      </div>
    </PublicShell>
  )
}
