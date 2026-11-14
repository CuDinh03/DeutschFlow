import '@/styles/galerie.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import { absoluteUrl, SITE_URL } from '@/lib/siteUrl'
import { ogImage } from '@/lib/ogImage'
import { breadcrumbStructuredData } from '@/lib/homeStructuredData'
import { GaBtn } from '@/components/ui-v2/GaBtn'
import { LandingHeader } from '@/components/landing-v2/LandingHeader'
import { LandingFooter } from '@/components/landing-v2/LandingFooter'
import { APP_STORE_URL, START_HREF } from '@/components/landing-v2/links'
import {
  ANDROID_NOTE,
  COMPARE_COLUMNS,
  COMPARE_NOTE,
  COMPARE_ROWS,
  DESCRIPTION,
  FAQS,
  H1,
  INTRO,
  PATH,
  PLANS,
  PLANS_FOOTNOTE,
  SCHOOL,
  TITLE,
  WHICH_PLAN,
  type PricePlan,
} from '@/data/chiPhiPage'

/**
 * "Chi phí" — `/chi-phi/` (14/11/2026). Chỉ tiếng Việt. Nội dung và luật ở `@/data/chiPhiPage`.
 * Không dùng schema Product/Offer: thanh toán web đang tắt (giá không mua được trên trang) — chỉ WebPage,
 * BreadcrumbList, FAQPage.
 */
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl(PATH) },
  openGraph: {
    type: 'website',
    title: TITLE,
    description: DESCRIPTION,
    locale: 'vi_VN',
    url: absoluteUrl(PATH),
    siteName: 'myDeutschFlow',
    images: [ogImage('home', 'vi', TITLE)],
  },
}

const YellowSq = () => <span className="inline-block h-[7px] w-[7px] shrink-0 bg-ga-yellow" />
const H2 = 'mb-5 mt-16 font-ga-display text-ga-h2 font-medium text-ga-ink sm:text-[32px]'
const A = 'underline decoration-ga-yellow decoration-2 underline-offset-4 hover:decoration-ga-ink'

function PlanCard({ plan }: { plan: PricePlan }) {
  const main = Boolean(plan.badge)
  const external = plan.cta === 'appStore'
  return (
    <section
      aria-labelledby={`plan-${plan.id}`}
      className={`flex flex-col border p-5 sm:p-6 ${main ? 'border-ga-ink bg-ga-ink text-ga-bg' : 'border-ga-border bg-ga-card text-ga-ink'}`}
    >
      <div className="flex min-h-[28px] items-center justify-between gap-3">
        <h3 id={`plan-${plan.id}`} className="text-ga-h3 font-semibold">{plan.name}</h3>
        {plan.badge ? (
          <span className="inline-flex items-center gap-2 bg-ga-yellow px-2 py-1 text-ga-caption font-semibold text-ga-ink">{plan.badge}</span>
        ) : null}
      </div>
      {/* Apple 3.1.2: số tiền bị trừ mỗi kỳ là chữ lớn nhất; số quy ra tháng chỉ là dòng phụ. */}
      <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
        <span className="font-ga-display text-[40px] font-medium leading-none">{plan.price}</span>
        {plan.period ? <span className={`text-ga-body ${main ? 'text-ga-subtle' : 'text-ga-muted'}`}>{plan.period}</span> : null}
      </p>
      {plan.perMonthNote ? (
        <p className={`mt-2 text-ga-small ${main ? 'text-ga-subtle' : 'text-ga-muted'}`}>{plan.perMonthNote}</p>
      ) : null}
      <ul className="mt-5 flex flex-1 flex-col gap-2 text-ga-body">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2">
            <span aria-hidden className={`mt-[9px] inline-block h-[6px] w-[6px] shrink-0 ${main ? 'bg-ga-yellow' : 'bg-ga-ink'}`} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {plan.limit ? <p className={`mt-4 text-ga-small ${main ? 'text-ga-subtle' : 'text-ga-muted'}`}>{plan.limit}</p> : null}
      {plan.renew ? <p className={`mt-4 text-ga-caption ${main ? 'text-ga-subtle' : 'text-ga-muted'}`}>{plan.renew}</p> : null}
      <div className="mt-5">
        <GaBtn asChild variant={main ? 'yellow' : 'ghost'} size="lg" className="min-h-[44px] w-full">
          {external ? (
            <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
              {plan.ctaLabel}
              <span className="sr-only"> (mở App Store trong thẻ mới)</span>
            </a>
          ) : (
            <Link href={START_HREF}>{plan.ctaLabel}</Link>
          )}
        </GaBtn>
      </div>
    </section>
  )
}

export default function ChiPhiPage() {
  const url = absoluteUrl(PATH)
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: TITLE,
        description: DESCRIPTION,
        inLanguage: 'vi-VN',
        isPartOf: { '@id': `${SITE_URL}/#website` },
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
      { ...breadcrumbStructuredData([['Trang chủ', '/'], ['Chi phí', PATH]]), '@context': undefined },
    ],
  }

  return (
    <div className="ga-scope min-h-screen overflow-x-clip bg-ga-bg font-ga-ui text-ga-ink">
      <LandingHeader current="none" showLanguage={false} />
      <main className="mx-auto max-w-[1240px] px-5 pb-16 pt-10 sm:px-8 md:pt-14 lg:px-[60px]">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
        <div className="max-w-[860px]">
          <div className="mb-[18px] inline-flex items-center gap-2 text-ga-eyebrow uppercase text-ga-muted">
            <YellowSq />Bảng giá
          </div>
          <h1 className="font-ga-display text-ga-h1-m font-medium leading-[1.1] sm:text-ga-h1">{H1}</h1>
          <p className="mt-5 text-ga-body-lg text-ga-ink">{INTRO}</p>
        </div>

        <h2 className={H2}>Gói cho người học</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((p) => (
            <PlanCard key={p.id} plan={p} />
          ))}
        </div>
        <p className="mt-5 max-w-[860px] text-ga-small text-ga-muted">{PLANS_FOOTNOTE}</p>

        <aside aria-label={ANDROID_NOTE.title} className="mt-8 max-w-[860px] border border-ga-border bg-ga-card p-5">
          <h3 className="text-ga-h3 text-ga-ink">{ANDROID_NOTE.title}</h3>
          <p className="mt-2 text-ga-body text-ga-ink">
            {ANDROID_NOTE.body.split('support@mydeutschflow.com')[0]}
            <a href="mailto:support@mydeutschflow.com" className={A}>support@mydeutschflow.com</a>
            {ANDROID_NOTE.body.split('support@mydeutschflow.com')[1]}
          </p>
        </aside>

        <div className="max-w-[860px]">
          <h2 className={H2}>Gói nào hợp với tôi?</h2>
          <dl className="border-t border-ga-border">
            {WHICH_PLAN.map((w) => (
              <div key={w.who} className="grid gap-1 border-b border-ga-border py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-6">
                <dt className="text-ga-body text-ga-muted">{w.who}</dt>
                <dd className="text-ga-body font-semibold text-ga-ink">{w.plan}</dd>
              </div>
            ))}
          </dl>
        </div>

        <h2 className={H2}>So sánh các gói</h2>
        <div className="overflow-x-auto border border-ga-border" role="region" aria-label="Bảng so sánh các gói" tabIndex={0}>
          <table className="w-full min-w-[720px] border-collapse text-left text-ga-small">
            <thead>
              <tr className="bg-ga-card">
                <th scope="col" className="p-3 font-semibold text-ga-muted">Bạn được gì</th>
                {COMPARE_COLUMNS.map((c) => (
                  <th key={c} scope="col" className="p-3 font-semibold text-ga-ink">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((r) => (
                <tr key={r.label} className="border-t border-ga-border">
                  <th scope="row" className="p-3 font-medium text-ga-ink">{r.label}</th>
                  {r.cells.map((cell, i) => (
                    <td key={`${r.label}-${i}`} className="p-3 text-ga-ink">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-[860px] text-ga-small text-ga-muted">{COMPARE_NOTE}</p>

        <div className="max-w-[860px]">
          <section aria-labelledby="trung-tam" className="mt-16 border border-ga-border bg-ga-card p-5 sm:p-6">
            <h2 id="trung-tam" className="font-ga-display text-[24px] font-medium text-ga-ink sm:text-[28px]">{SCHOOL.title}</h2>
            <p className="mt-2 text-ga-body text-ga-ink">{SCHOOL.body}</p>
            <div className="mt-5">
              <GaBtn asChild variant="ink" size="lg" className="min-h-[44px] w-full sm:w-auto">
                <Link href={SCHOOL.ctaHref}><YellowSq />{SCHOOL.ctaLabel}</Link>
              </GaBtn>
            </div>
          </section>

          <h2 className={H2}>Câu hỏi về chi phí</h2>
          <div className="border-t border-ga-border">
            {FAQS.map((f) => (
              <div key={f.q} className="border-b border-ga-border py-4">
                <h3 className="text-ga-h3 text-ga-ink">{f.q}</h3>
                <p className="mt-2 text-ga-body text-ga-muted">{f.a}</p>
              </div>
            ))}
          </div>

          <h2 className={H2}>Bắt đầu miễn phí, chưa cần chọn gói.</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <GaBtn asChild variant="ink" size="lg" className="min-h-[44px] w-full sm:w-auto">
              <Link href={START_HREF}><YellowSq />Học thử miễn phí</Link>
            </GaBtn>
            <GaBtn asChild variant="ghost" size="lg" className="min-h-[44px] w-full sm:w-auto">
              <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
                Tải trên App Store<span className="sr-only"> (mở trong thẻ mới)</span>
              </a>
            </GaBtn>
          </div>
          <p className="mt-3 text-ga-small text-ga-muted">Không cần thanh toán trước · 7 ngày Pro · App iPhone; Android dùng bản web</p>
          <p className="mt-8 text-ga-small text-ga-muted">
            Xem thêm: <Link href="/luyen-thi/telc-b1/" className={A}>cấu trúc đề telc B1</Link>,{' '}
            <Link href="/phong-van/" className={A}>phỏng vấn theo nghề</Link>,{' '}
            <Link href="/free-grade/" className={A}>chấm thử bài viết</Link>,{' '}
            <Link href="/terms/" className={A}>Điều khoản sử dụng</Link>, <Link href="/privacy/" className={A}>Chính sách bảo mật</Link>.
          </p>
        </div>
      </main>
      <LandingFooter />
    </div>
  )
}
