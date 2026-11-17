import '@/styles/galerie.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { absoluteUrl, SITE_URL } from '@/lib/siteUrl'
import { ogImage } from '@/lib/ogImage'
import { breadcrumbStructuredData } from '@/lib/homeStructuredData'
import { GaBtn } from '@/components/ui-v2/GaBtn'
import { PublicShell } from '@/components/landing-v2/PublicShell'
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
 * "Chi phí" — `/chi-phi/` (nâng cấp v3.4 — 14/11/2026). Chỉ tiếng Việt. Nội dung và luật ở `@/data/chiPhiPage`.
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

const YellowSq = ({ dark = false }: { dark?: boolean }) => (
  <span className={`inline-block h-[7px] w-[7px] shrink-0 ${dark ? 'bg-ga-ink' : 'bg-ga-yellow'}`} />
)
const H2 = 'mb-5 mt-14 font-ga-display text-ga-m-h2-m sm:text-ga-m-h2-t text-ga-ink'
const A = 'font-medium text-ga-navy underline decoration-ga-yellow decoration-2 underline-offset-4 hover:decoration-ga-ink'

function PlanCard({ plan }: { plan: PricePlan }) {
  const main = Boolean(plan.badge)
  const external = plan.cta === 'appStore'
  return (
    <section
      aria-labelledby={`plan-${plan.id}`}
      className={`flex flex-col rounded-ga-lg border p-5 transition-shadow sm:p-6 ${
        main
          ? '-order-1 border-ga-ink bg-ga-ink text-ga-bg shadow-ga-lg md:order-none'
          : 'border-ga-border bg-ga-card text-ga-ink shadow-ga-sm'
      }`}
    >
      <div className="flex min-h-7 items-center justify-between gap-3">
        <h3 id={`plan-${plan.id}`} className="text-ga-h3 font-semibold">{plan.name}</h3>
        {plan.badge ? (
          <span className="inline-flex items-center gap-1.5 rounded-ga-pill bg-ga-yellow px-2.5 py-0.5 text-ga-caption font-bold text-ga-ink">
            {plan.badge}
          </span>
        ) : null}
      </div>
      {/* Apple 3.1.2: số tiền bị trừ mỗi kỳ là chữ lớn nhất; số quy ra tháng chỉ là dòng phụ. */}
      <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
        <span className="font-ga-display text-ga-numeral-m sm:text-ga-numeral-xl">{plan.price}</span>
        {plan.period ? <span className={`text-ga-body ${main ? 'text-ga-subtle' : 'text-ga-muted'}`}>{plan.period}</span> : null}
      </p>
      {plan.perMonthNote ? (
        <p className={`mt-2 text-ga-small ${main ? 'text-ga-subtle' : 'text-ga-muted'}`}>{plan.perMonthNote}</p>
      ) : null}
      <ul className="mt-5 flex flex-1 flex-col gap-2.5 text-ga-body">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <span aria-hidden className={`mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-ga-pill ${main ? 'bg-ga-yellow' : 'bg-ga-ink'}`} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {plan.limit ? <p className={`mt-4 text-ga-small ${main ? 'text-ga-subtle' : 'text-ga-muted'}`}>{plan.limit}</p> : null}
      {plan.renew ? <p className={`mt-4 text-ga-caption ${main ? 'text-ga-subtle' : 'text-ga-muted'}`}>{plan.renew}</p> : null}
      <div className="mt-5">
        <GaBtn
          asChild
          variant={main ? 'yellow' : 'ghost'}
          size="lg"
          className={`min-h-11 w-full ${main ? 'ga-btn-gleam' : ''}`}
        >
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
    <PublicShell
      current="pricing"
      showLanguage={false}
      stickyCta="b2c"
      className="ga-scope"
      mainClassName="mx-auto w-full max-w-[1240px] px-5 pb-20 pt-8 sm:px-8 md:pt-14 lg:px-[60px]"
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <div className="max-w-[860px]">
        <div className="mb-4 inline-flex items-center gap-2 rounded-ga-pill border border-ga-border bg-ga-card px-3.5 py-1.5 text-ga-eyebrow uppercase text-ga-ink shadow-ga-sm">
          <YellowSq />Bảng giá minh bạch
        </div>
        <h1 className="font-ga-display text-ga-m-h1-m sm:text-ga-m-h1-t lg:text-ga-m-h1 text-ga-ink">{H1}</h1>
        <p className="mt-4 text-ga-m-lead text-ga-ink">{INTRO}</p>
      </div>

      <h2 className={H2}>Gói cho người học</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((p) => (
          <PlanCard key={p.id} plan={p} />
        ))}
      </div>
      <p className="mt-5 max-w-[860px] text-ga-small text-ga-muted">{PLANS_FOOTNOTE}</p>

      <aside
        aria-label={ANDROID_NOTE.title}
        className="mt-8 max-w-[860px] rounded-ga-lg border border-ga-border-strong bg-ga-yellow-soft p-5 shadow-ga-sm sm:p-6"
      >
        <h3 className="text-ga-h3 text-ga-ink">{ANDROID_NOTE.title}</h3>
        <p className="mt-2 text-ga-body text-ga-ink">
          {ANDROID_NOTE.body.split('support@mydeutschflow.com')[0]}
          <a href="mailto:support@mydeutschflow.com" className={A}>support@mydeutschflow.com</a>
          {ANDROID_NOTE.body.split('support@mydeutschflow.com')[1]}
        </p>
      </aside>

      <div className="max-w-[860px]">
        <h2 className={H2}>Gói nào hợp với tôi?</h2>
        <dl className="divide-y divide-ga-border rounded-ga-lg border border-ga-border bg-ga-card px-5 shadow-ga-sm sm:px-6">
          {WHICH_PLAN.map((w) => (
            <div key={w.who} className="grid gap-1 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-6">
              <dt className="text-ga-body text-ga-muted">{w.who}</dt>
              <dd className="text-ga-body font-semibold text-ga-ink">{w.plan}</dd>
            </div>
          ))}
        </dl>
      </div>

      <h2 className={H2}>So sánh các gói</h2>
      <div
        className="overflow-x-auto rounded-ga-lg border border-ga-border bg-ga-card shadow-ga-sm"
        role="region"
        aria-label="Bảng so sánh các gói"
        tabIndex={0}
      >
        <table className="w-full min-w-[720px] border-collapse text-left text-ga-small">
          <thead>
            <tr className="bg-ga-surface-2">
              <th scope="col" className="p-3.5 font-semibold text-ga-muted">Bạn được gì</th>
              {COMPARE_COLUMNS.map((c) => (
                <th key={c} scope="col" className="p-3.5 font-semibold text-ga-ink">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((r) => (
              <tr key={r.label} className="border-t border-ga-border">
                <th scope="row" className="p-3.5 font-medium text-ga-ink">{r.label}</th>
                {r.cells.map((cell, i) => (
                  <td key={`${r.label}-${i}`} className="p-3.5 text-ga-ink">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 max-w-[860px] text-ga-small text-ga-muted">{COMPARE_NOTE}</p>

      <div className="max-w-[860px]">
        <section aria-labelledby="trung-tam" className="mt-14 rounded-ga-lg border border-ga-border-strong bg-ga-card p-6 shadow-ga-sm sm:p-7">
          <h2 id="trung-tam" className="font-ga-display text-ga-h1-m text-ga-ink sm:text-ga-h1">{SCHOOL.title}</h2>
          <p className="mt-2.5 text-ga-body-lg text-ga-muted">{SCHOOL.body}</p>
          <div className="mt-5">
            <GaBtn asChild variant="ink" size="lg" className="min-h-11 w-full sm:w-auto">
              <Link href={SCHOOL.ctaHref}><YellowSq />{SCHOOL.ctaLabel}</Link>
            </GaBtn>
          </div>
        </section>

        <h2 className={H2}>Câu hỏi về chi phí</h2>
        <div className="divide-y divide-ga-border rounded-ga-lg border border-ga-border bg-ga-card px-5 shadow-ga-sm sm:px-6">
          {FAQS.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 text-ga-h3 text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus">
                {f.q}
                <Plus size={18} aria-hidden className="shrink-0 text-ga-muted transition-transform group-open:rotate-45" />
              </summary>
              <p className="pb-4 text-ga-body text-ga-muted">{f.a}</p>
            </details>
          ))}
        </div>

        <div className="mt-14 rounded-ga-xl bg-ga-ink p-6 text-ga-bg shadow-ga-md sm:p-8">
          <h2 className="font-ga-display text-ga-h1-m text-ga-bg sm:text-ga-h1">Bắt đầu miễn phí, chưa cần chọn gói.</h2>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <GaBtn asChild variant="yellow" size="lg" className="ga-btn-gleam min-h-11 w-full sm:w-auto">
              <Link href={START_HREF}><YellowSq dark />Học thử miễn phí</Link>
            </GaBtn>
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-ga-pill border border-ga-subtle px-5 text-ga-body font-semibold text-ga-bg transition-colors hover:border-ga-yellow hover:text-ga-yellow"
            >
              Tải trên App Store<span className="sr-only"> (mở trong thẻ mới)</span>
            </a>
          </div>
          <p className="mt-3 text-ga-small text-ga-subtle">Không cần thanh toán trước · Dùng thử 7 ngày · App iPhone; Android dùng bản web</p>
        </div>

        <p className="mt-8 text-ga-small text-ga-muted">
          Xem thêm: <Link href="/luyen-thi/telc-b1/" className={A}>cấu trúc đề telc B1</Link>,{' '}
          <Link href="/phong-van/" className={A}>phỏng vấn theo nghề</Link>,{' '}
          <Link href="/free-grade/" className={A}>chấm thử bài viết</Link>,{' '}
          <Link href="/terms/" className={A}>Điều khoản sử dụng</Link>, <Link href="/privacy/" className={A}>Chính sách bảo mật</Link>.
        </p>
      </div>
    </PublicShell>
  )
}
