import '@/styles/galerie.css'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { GERMAN_EXAMS } from '@/data/germanExams'
import { absoluteUrl } from '@/lib/siteUrl'
import { ogImage } from '@/lib/ogImage'
import { GaBtn } from '@/components/ui-v2/GaBtn'
import { GaGlyphMark } from '@/components/ui-v2/GaGlyphMark'
import { LandingHeader } from '@/components/landing-v2/LandingHeader'
import { LandingFooter } from '@/components/landing-v2/LandingFooter'
import { MobileStickyCta } from '@/components/landing-v2/MobileStickyCta'
import { PUBLIC_V3_ASSETS } from '@/components/landing-v2/publicV3Assets'
import { START_HREF } from '@/components/landing-v2/links'

/**
 * Trang tổng luyện thi `/luyen-thi/` (chỉ tiếng Việt, nâng cấp v3.4 — 14/11/2026):
 * - Hero cổng Brandenburg sương sớm (`berlin-brandenburg-mist.webp`).
 * - Làm nổi bật `telc Deutsch B1` là kỳ thi DUY NHẤT có đề thi thử online 4 kỹ năng;
 *   các kỳ thi Goethe và telc khác hiển thị rõ vai trò hướng dẫn cấu trúc đề + dẫn sang chấm thử Schreiben.
 */
const TITLE = 'Thi thử telc B1 online, cấu trúc đề Goethe · myDeutschFlow'
const DESCRIPTION =
  'Cấu trúc đề, cách tính điểm và checklist ôn thi Goethe, telc (A2, B1, B2, Pflege). Thi thử telc B1 online và chấm thử bài viết miễn phí.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl('/luyen-thi/') },
  robots: { index: true, follow: true },
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
  const telcB1 = GERMAN_EXAMS.find((e) => e.slug === 'telc-b1')
  const byProvider = {
    telc: GERMAN_EXAMS.filter((e) => e.provider === 'telc'),
    Goethe: GERMAN_EXAMS.filter((e) => e.provider === 'Goethe'),
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
    <div className="ga-scope ga-public min-h-screen overflow-x-clip bg-ga-bg font-ga-ui text-ga-ink">
      <LandingHeader current="exam" showLanguage={false} />
      <main>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />

        {/* Hero bình minh cổng Brandenburg */}
        <section className="relative isolate overflow-hidden border-b border-ga-border">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <Image
              src={PUBLIC_V3_ASSETS.berlinMistHero}
              alt=""
              priority
              sizes="100vw"
              className="df-mist-drift h-full w-full object-cover object-center opacity-20"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, color-mix(in srgb, var(--ga-bg) 70%, transparent) 0%, color-mix(in srgb, var(--ga-bg) 92%, transparent) 72%, var(--ga-bg) 100%)',
              }}
            />
          </div>

          <div className="mx-auto max-w-[1240px] px-5 pb-12 pt-8 sm:px-8 md:pb-16 md:pt-14 lg:px-[60px]">
            <div className="mb-4 inline-flex items-center gap-2 rounded-ga-pill border border-ga-border bg-ga-card px-3.5 py-1.5 text-ga-eyebrow uppercase text-ga-ink shadow-ga-sm">
              <YellowSq />Luyện thi tiếng Đức
            </div>
            <h1 className="max-w-[860px] font-ga-display text-ga-m-h1-m sm:text-ga-m-h1-t lg:text-ga-m-h1 text-ga-ink">
              Luyện thi tiếng Đức <em className="ga-hero-mark italic">telc B1</em> và cấu trúc đề Goethe
            </h1>
            <p className="mt-4 max-w-[680px] text-ga-m-lead text-ga-muted">
              Cấu trúc đề, cách tính điểm và checklist ôn thi Goethe, telc. Riêng telc Deutsch B1 có phòng thi thử online đủ 4 phần, mô phỏng thời gian và cấu trúc đề thật.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <GaBtn asChild variant="yellow" size="lg" className="ga-btn-gleam w-full sm:w-auto">
                <Link href={START_HREF}><YellowSq dark />Học thử miễn phí</Link>
              </GaBtn>
              <GaBtn asChild variant="ghost" size="lg" className="w-full sm:w-auto">
                <Link href="/free-grade/">Chấm thử bài viết miễn phí</Link>
              </GaBtn>
            </div>
            <p className="mt-4 flex items-start gap-2.5 text-ga-small text-ga-muted">
              <span className="mt-1.5 inline-block h-[7px] w-[7px] shrink-0 bg-ga-yellow" />
              <span>
                Thi thử hiện chỉ có cho telc B1, mô phỏng định dạng đề. Các trang Goethe chỉ hướng dẫn cấu trúc đề. myDeutschFlow không liên kết với Goethe-Institut hay telc.
              </span>
            </p>

            {/* Thẻ tiêu điểm telc Deutsch B1 */}
            {telcB1 && (
              <div className="mt-9 rounded-ga-xl border border-ga-ink bg-ga-ink p-5 text-ga-bg shadow-ga-lg sm:p-7">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-[680px]">
                    <div className="mb-2 inline-flex items-center gap-2 rounded-ga-pill bg-ga-yellow px-3 py-0.5 text-ga-caption font-bold text-ga-ink">
                      Có phòng thi thử online 4 kỹ năng
                    </div>
                    <h2 className="font-ga-display text-ga-h1-m text-ga-bg sm:text-ga-h1">{telcB1.name}</h2>
                    <p className="mt-2 text-ga-body text-ga-subtle">{telcB1.tagline}</p>
                    <div className="mt-4 flex flex-wrap gap-2 text-ga-caption text-ga-bg">
                      <span className="rounded-ga-pill border border-ga-subtle px-3 py-1">Lesen + Sprachbausteine · 90 phút</span>
                      <span className="rounded-ga-pill border border-ga-subtle px-3 py-1">Hören · 30 phút</span>
                      <span className="rounded-ga-pill border border-ga-subtle px-3 py-1">Schreiben · 30 phút</span>
                      <span className="rounded-ga-pill border border-ga-subtle px-3 py-1">Sprechen · 15 phút (Beta)</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row lg:flex-col">
                    <GaBtn asChild variant="yellow" size="lg" className="ga-btn-gleam w-full sm:w-auto">
                      <Link href={`/luyen-thi/${telcB1.slug}/`}>
                        Xem đề & cấu trúc telc B1 <ArrowRight size={16} aria-hidden />
                      </Link>
                    </GaBtn>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Danh mục tất cả kỳ thi */}
        <div className="mx-auto flex max-w-[1240px] flex-col gap-12 px-5 py-14 sm:px-8 lg:px-[60px]">
          {(['telc', 'Goethe'] as const).map((provider) => (
            <section key={provider} aria-labelledby={`exam-${provider}`}>
              <div className="mb-5 flex items-center justify-between gap-3 border-b border-ga-border pb-3">
                <div className="flex items-center gap-2.5">
                  <GaGlyphMark name="thithu" size={24} className="shrink-0 text-ga-ink" />
                  <h2 id={`exam-${provider}`} className="font-ga-display text-ga-h2 text-ga-ink">
                    Kỳ thi {provider}
                  </h2>
                </div>
                <span className="text-ga-caption text-ga-muted">
                  {provider === 'Goethe' ? 'Hướng dẫn cấu trúc đề & checklist' : 'Cấu trúc đề & thi thử telc B1'}
                </span>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {byProvider[provider].map((e) => {
                  const hasMock = e.slug === 'telc-b1'
                  return (
                    <li key={e.slug}>
                      <Link
                        href={`/luyen-thi/${e.slug}`}
                        className="group flex h-full flex-col rounded-ga-lg border border-ga-border bg-ga-card p-5 shadow-ga-sm transition-all hover:border-ga-ink hover:shadow-ga-md sm:p-6"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-ga-eyebrow uppercase text-ga-muted">{e.provider} · {e.level}</span>
                          <span
                            className={`rounded-ga-pill px-2.5 py-0.5 text-ga-caption font-semibold ${
                              hasMock ? 'bg-ga-yellow text-ga-ink' : 'bg-ga-surface-2 text-ga-muted'
                            }`}
                          >
                            {hasMock ? 'Có thi thử online' : 'Cẩm nang cấu trúc'}
                          </span>
                        </div>
                        <span className="mt-2.5 font-ga-display text-ga-h2 text-ga-ink">{e.name}</span>
                        <span className="mt-1.5 flex-1 text-ga-small text-ga-muted">{e.tagline}</span>
                        <span className="mt-4 inline-flex items-center gap-1.5 text-ga-small font-semibold text-ga-navy underline decoration-ga-yellow decoration-2 underline-offset-4 group-hover:decoration-ga-ink">
                          Xem hướng dẫn <ArrowRight size={14} aria-hidden />
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      </main>
      <LandingFooter />
      <MobileStickyCta mode="b2c" />
    </div>
  )
}
