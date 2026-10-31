import Link from 'next/link'
import { GaBtn } from '@/components/ui-v2/GaBtn'
import {
  AUSBILDUNG_CHECKED_AT,
  AUSBILDUNG_COPY,
  AUSBILDUNG_SOURCES,
} from '@/content/ausbildung'
import {
  AUSBILDUNG_COMPANIES,
  AUSBILDUNG_CONTENT_REVIEWED,
  AUSBILDUNG_OCCUPATIONS,
  ausbildungDeUrl,
  jobsucheUrl,
  type AusbildungLocale,
  type AusbildungOccupation,
} from '@/lib/ausbildung'
import { WORKPLACES, occupationName, type OccupationSummary } from '@/lib/occupationTypes'
import { localizedHref, publicHref } from '@/lib/publicLocale'
import { AusbildungChecklist } from './AusbildungChecklist'
import { AusbildungCompanies } from './AusbildungCompanies'
import { LandingFooter } from './LandingFooter'
import { LandingHeader } from './LandingHeader'
import { START_HREF } from './links'

/**
 * Trang học nghề (Ausbildung) giai đoạn 1 — `/hoc-nghe/` và `/en/vocational-training/`.
 *
 * Trang hướng dẫn kèm danh bạ doanh nghiệp, KHÔNG phải cổng tuyển dụng: không đăng tin, không nhận hồ
 * sơ, không làm trung gian. Người học bấm sang website của doanh nghiệp và ứng tuyển ở đó. Toàn bộ trang
 * công khai, miễn phí (`AUSBILDUNG_COMPANIES` nói rõ vì sao).
 * Cổng hiển thị và lý do xem `@/lib/ausbildung`; chữ ở `@/content/ausbildung`.
 */

const SECTION = 'mx-auto max-w-[1240px] px-5 py-12 sm:px-8 md:py-16 lg:px-[60px]'
const H2 = 'font-ga-display text-ga-display-m text-ga-ink md:text-ga-display'
const YellowSq = () => <span className="inline-block h-[7px] w-[7px] shrink-0 bg-ga-yellow" />

const STEPS_ANCHOR = 'cac-buoc'
const OCCUPATIONS_ANCHOR = 'nghe'
const COMPANIES_ANCHOR = 'doanh-nghiep'

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ga-navy">
      {children}
    </a>
  )
}

function joinCatalog(occupations: OccupationSummary[] | null) {
  if (!occupations) return null
  const byCode = new Map(occupations.map((o) => [o.code, o]))
  return AUSBILDUNG_OCCUPATIONS.flatMap((a) => {
    const o = byCode.get(a.code)
    return o ? [{ ...o, training: a }] : []
  })
}

export function AusbildungPage({
  locale,
  occupations,
  preview,
}: {
  locale: AusbildungLocale
  occupations: OccupationSummary[] | null
  preview: boolean
}) {
  const c = AUSBILDUNG_COPY[locale]
  const trades = joinCatalog(occupations)
  const tradeHref = (code: string) => {
    const href = localizedHref(locale, `/phong-van/${code}`)
    return preview && !AUSBILDUNG_CONTENT_REVIEWED ? `${href}?ban-nhap=1` : href
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-ga-bg font-ga-ui text-ga-ink">
      <LandingHeader current="training" />
      {preview && !AUSBILDUNG_CONTENT_REVIEWED && (
        <p role="status" className="border-b border-ga-yellow bg-ga-yellow-soft px-5 py-2.5 text-center text-ga-small font-semibold text-ga-ink">
          {c.draftBanner}
        </p>
      )}
      <main>
        <section className={SECTION}>
          <div className="mb-[18px] inline-flex items-center gap-2 text-ga-eyebrow uppercase text-ga-muted">
            <YellowSq />{c.hero.cap}
          </div>
          <h1 className="max-w-[860px] font-ga-display text-ga-display-m text-ga-ink md:text-ga-display">{c.hero.title}</h1>
          <p className="mt-6 max-w-[640px] text-ga-body-lg text-ga-muted">{c.hero.sub}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <GaBtn asChild variant="ink" size="lg" className="w-full sm:w-auto">
              <a href={`#${STEPS_ANCHOR}`}><YellowSq /><span className="text-ga-body">{c.hero.ctaSteps}</span></a>
            </GaBtn>
            <GaBtn asChild variant="ghost" size="lg" className="w-full sm:w-auto">
              <a href={`#${OCCUPATIONS_ANCHOR}`}><span className="text-ga-body">{c.hero.ctaOccupations}</span></a>
            </GaBtn>
          </div>
        </section>

        <section className={`${SECTION} border-t border-ga-border`}>
          <h2 className={H2}>{c.what.title}</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {c.what.points.map((p) => (
              <div key={p.title} className="border-l-2 border-ga-yellow pl-4">
                <h3 className="text-ga-h3 text-ga-ink">{p.title}</h3>
                <p className="mt-2 text-ga-body text-ga-muted">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={`${SECTION} border-t border-ga-border`}>
          <h2 className={H2}>{c.routes.title}</h2>
          <p className="mt-4 max-w-[640px] text-ga-body-lg text-ga-muted">{c.routes.intro}</p>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {c.routes.items.map((r) => (
              <div key={r.law} className="border border-ga-border bg-ga-card p-5">
                <h3 className="text-ga-h3 text-ga-ink">{r.name}</h3>
                <p className="mt-1 text-ga-caption text-ga-muted">{r.law}</p>
                <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-ga-body text-ga-ink">
                  {r.points.map((p) => <li key={p}>{p}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section id={STEPS_ANCHOR} className={`${SECTION} scroll-mt-24 border-t border-ga-border`}>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14">
            <div className="min-w-0">
              <h2 className={H2}>{c.steps.title}</h2>
              <p className="mb-8 mt-4 max-w-[640px] text-ga-body-lg text-ga-muted">{c.steps.intro}</p>
              <AusbildungChecklist copy={c.steps} />
            </div>
            <aside className="flex flex-col gap-5 lg:sticky lg:top-28 lg:self-start">
              <div className="border border-ga-yellow bg-ga-yellow-soft p-5">
                <h3 className="text-ga-h3 text-ga-ink">{c.money.title}</h3>
                <p className="mt-2 text-ga-body text-ga-ink">{c.money.body}</p>
                <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-ga-small text-ga-ink">
                  {c.money.points.map((p) => <li key={p}>{p}</li>)}
                </ul>
              </div>
            </aside>
          </div>
        </section>

        <section className={`${SECTION} border-t border-ga-border`}>
          <h2 className={H2}>{c.find.title}</h2>
          <p className="mt-4 max-w-[640px] text-ga-body-lg text-ga-muted">{c.find.intro}</p>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {c.find.portals.map((p) => (
              <div key={p.url} className="border border-ga-border bg-ga-card p-5">
                <h3 className="text-ga-h3 text-ga-ink"><ExternalLink href={p.url}>{p.name}</ExternalLink></h3>
                <p className="mt-2 text-ga-body text-ga-muted">{p.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 border-l-2 border-ga-yellow pl-3 text-ga-body text-ga-muted">{c.find.warning}</p>
        </section>

        <section id={COMPANIES_ANCHOR} className={`${SECTION} scroll-mt-24 border-t border-ga-border`}>
          <h2 className={H2}>{c.companies.title}</h2>
          <p className="mb-8 mt-4 max-w-[640px] text-ga-body-lg text-ga-muted">{c.companies.intro}</p>
          <AusbildungCompanies copy={c.companies} companies={AUSBILDUNG_COMPANIES} />
        </section>

        <section id={OCCUPATIONS_ANCHOR} className={`${SECTION} scroll-mt-24 border-t border-ga-border`}>
          <h2 className={H2}>{c.occupations.title}</h2>
          <p className="mt-4 max-w-[640px] text-ga-body-lg text-ga-muted">{c.occupations.intro}</p>
          {!trades ? (
            <p className="mt-8 border-l-2 border-ga-yellow pl-3 text-ga-body text-ga-muted">{c.occupations.unavailable}</p>
          ) : (
            <div className="mt-8 flex flex-col gap-8">
              {WORKPLACES.map((w) => {
                const items = trades.filter((o) => o.workplace === w)
                if (!items.length) return null
                return (
                  <ul key={w} className="grid gap-x-6 gap-y-1 border-t border-ga-border pt-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((o) => (
                      <li key={o.code}>
                        <Link href={tradeHref(o.code)} className="block min-h-11 py-2 hover:text-ga-navy">
                          <span className="block text-ga-body font-semibold">{o.nameDe}</span>
                          <span className="block text-ga-caption text-ga-muted">
                            {occupationName(o, locale)} · {formatYears(o.training, locale)} {c.occupations.yearsUnit} · {c.occupations.levelPrefix} {o.training.level}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )
              })}
            </div>
          )}
        </section>

        <section className={`${SECTION} border-t border-ga-border`}>
          <div className="border border-ga-border bg-ga-card p-6 md:p-8">
            <h2 className="font-ga-display text-ga-h1-m text-ga-ink">{c.practice.title}</h2>
            <p className="mt-3 max-w-[640px] text-ga-body-lg text-ga-muted">{c.practice.body}</p>
            <GaBtn asChild variant="ink" size="lg" className="mt-6 w-full sm:w-auto">
              <Link href={START_HREF}><YellowSq /><span className="text-ga-body">{c.practice.cta}</span></Link>
            </GaBtn>
          </div>
          <p className="mt-8 text-ga-body text-ga-muted">{c.disclaimer}</p>
          <p className="mt-2 text-ga-small text-ga-muted">{c.checkedLabel}: {AUSBILDUNG_CHECKED_AT}</p>
          <h2 className="mt-6 text-ga-body font-semibold text-ga-ink">{c.sourcesTitle}</h2>
          <ul className="mt-2 flex flex-col gap-1 text-ga-small text-ga-muted">
            {AUSBILDUNG_SOURCES.map((s) => (
              <li key={s.url}><ExternalLink href={s.url}>{s.label}</ExternalLink></li>
            ))}
          </ul>
        </section>
      </main>
      <LandingFooter />
    </div>
  )
}

function formatYears(a: AusbildungOccupation, locale: AusbildungLocale): string {
  return locale === 'vi' ? String(a.years).replace('.', ',') : String(a.years)
}

/** Khối học nghề trên trang nghề. Chỉ hiện với nghề có Ausbildung và khi cổng nội dung đang mở. */
export function AusbildungOccupationBlock({
  training,
  locale,
  preview,
}: {
  training: AusbildungOccupation
  locale: AusbildungLocale
  preview: boolean
}) {
  const c = AUSBILDUNG_COPY[locale]
  const b = c.occupationBlock
  const guide = publicHref(locale, '/hoc-nghe') ?? '/hoc-nghe/'
  const guideHref = preview && !AUSBILDUNG_CONTENT_REVIEWED ? `${guide}?ban-nhap=1` : guide
  return (
    <section aria-labelledby="ausbildung-block" className="mt-10 border border-ga-border bg-ga-card p-5">
      <h2 id="ausbildung-block" className="text-ga-h3 text-ga-ink">{b.cap}</h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-ga-caption text-ga-muted">{b.years}</dt>
          <dd className="text-ga-body font-semibold text-ga-ink">{formatYears(training, locale)} {c.occupations.yearsUnit}</dd>
        </div>
        <div>
          <dt className="text-ga-caption text-ga-muted">{b.level}</dt>
          <dd className="text-ga-body font-semibold text-ga-ink">{training.level}</dd>
        </div>
      </dl>
      <p className="mt-3 text-ga-small text-ga-muted">{b.paid}. {b.levelNote}</p>
      <div className="mt-4 flex flex-col gap-2 text-ga-body sm:flex-row sm:flex-wrap sm:gap-x-6">
        <ExternalLink href={jobsucheUrl(training.searchDe)}>{b.findBa}</ExternalLink>
        <ExternalLink href={ausbildungDeUrl(training.searchDe)}>{b.findAusbildungDe}</ExternalLink>
        <Link href={`${guideHref}#${COMPANIES_ANCHOR}`} className="underline underline-offset-2 hover:text-ga-navy">{b.companies}</Link>
        <Link href={guideHref} className="font-semibold underline underline-offset-2 hover:text-ga-navy">{b.guide}</Link>
      </div>
    </section>
  )
}
