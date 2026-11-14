import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { GaBtn } from '@/components/ui-v2/GaBtn'
import {
  AUSBILDUNG_CHECKED_AT,
  AUSBILDUNG_COPY,
  AUSBILDUNG_SOURCES,
} from '@/content/ausbildung'
import {
  AUSBILDUNG_COMPANIES,
  AUSBILDUNG_OCCUPATIONS,
  ausbildungDeUrl,
  jobsucheUrl,
  type AusbildungOccupation,
} from '@/lib/ausbildung'
import {
  AUSBILDUNG_CONTENT_REVIEWED,
  AUSBILDUNG_PAGE,
  withDraftPreview,
  type AusbildungLocale,
} from '@/lib/ausbildungGate'
import { WORKPLACES, occupationName, type OccupationSummary } from '@/lib/occupationTypes'
import { localizedHref, publicHref } from '@/lib/publicLocale'
import { AusbildungChecklist } from './AusbildungChecklist'
import { AusbildungCompanies } from './AusbildungCompanies'
import { PublicShell } from './PublicShell'
import { START_HREF } from './links'

/**
 * Trang học nghề (Ausbildung) giai đoạn 1 — `/hoc-nghe/` và `/en/vocational-training/` (chuẩn giao diện v3.4).
 *
 * Trang hướng dẫn kèm danh bạ doanh nghiệp, KHÔNG phải cổng tuyển dụng: không đăng tin, không nhận hồ
 * sơ, không làm trung gian. Người học bấm sang website của doanh nghiệp và ứng tuyển ở đó.
 */

const SECTION = 'mx-auto max-w-[1240px] px-5 py-12 sm:px-8 md:py-16 lg:px-[60px]'
const H2 = 'font-ga-display text-ga-m-h2-m font-medium text-ga-ink sm:text-ga-m-h2-t lg:text-ga-m-h2'
const YellowDot = () => <span className="inline-block h-2 w-2 shrink-0 rounded-ga-pill bg-ga-yellow" />

const STEPS_ANCHOR = 'cac-buoc'
const OCCUPATIONS_ANCHOR = 'nghe'
const COMPANIES_ANCHOR = 'doanh-nghiep'

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-ga-navy underline decoration-ga-yellow decoration-2 underline-offset-4 hover:text-ga-ink"
    >
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
}: {
  locale: AusbildungLocale
  occupations: OccupationSummary[] | null
}) {
  const c = AUSBILDUNG_COPY[locale]
  const trades = joinCatalog(occupations)
  const tradeHref = (code: string) => withDraftPreview(localizedHref(locale, `/phong-van/${code}`))

  return (
    <PublicShell current="training" stickyCta="b2c" mainClassName="pb-16 md:pb-0">
      {!AUSBILDUNG_CONTENT_REVIEWED && (
        <p role="status" className="border-b border-ga-yellow bg-ga-yellow-soft px-5 py-2.5 text-center text-ga-small font-semibold text-ga-ink">
          {c.draftBanner}
        </p>
      )}

      <section className={SECTION}>
        <div className="rounded-ga-xl border border-ga-border bg-ga-card p-6 shadow-ga-sm sm:p-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-ga-pill border border-ga-border bg-ga-bg px-3.5 py-1 text-ga-eyebrow uppercase text-ga-muted">
            <YellowDot />
            {c.hero.cap}
          </div>
          <h1 className="max-w-[860px] font-ga-display text-ga-m-h1-m font-medium text-ga-ink sm:text-ga-m-h1-t lg:text-ga-m-h1">
            {c.hero.title}
          </h1>
          <p className="mt-4 max-w-[660px] text-ga-m-lead text-ga-muted">{c.hero.sub}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <GaBtn asChild variant="yellow" size="lg" className="ga-btn-gleam w-full sm:w-auto">
              <a href={`#${STEPS_ANCHOR}`}>
                <span className="text-ga-body">{c.hero.ctaSteps}</span>
                <ArrowRight size={16} aria-hidden />
              </a>
            </GaBtn>
            <GaBtn asChild variant="ghost" size="lg" className="w-full sm:w-auto">
              <a href={`#${OCCUPATIONS_ANCHOR}`}>
                <span className="text-ga-body">{c.hero.ctaOccupations}</span>
              </a>
            </GaBtn>
          </div>
        </div>
      </section>

      <section className={`${SECTION} border-t border-ga-border`}>
        <h2 className={H2}>{c.what.title}</h2>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {c.what.points.map((p) => (
            <div key={p.title} className="rounded-ga-xl border border-ga-border bg-ga-card p-6 shadow-ga-sm">
              <span className="mb-3 block h-1.5 w-8 rounded-ga-pill bg-ga-yellow" />
              <h3 className="font-ga-display text-ga-m-h3 font-medium text-ga-ink">{p.title}</h3>
              <p className="mt-2 text-ga-body text-ga-muted">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={`${SECTION} border-t border-ga-border`}>
        <h2 className={H2}>{c.routes.title}</h2>
        <p className="mt-3 max-w-[640px] text-ga-m-lead text-ga-muted">{c.routes.intro}</p>
        <div className="mt-7 grid gap-5 md:grid-cols-2">
          {c.routes.items.map((r) => (
            <div key={r.law} className="rounded-ga-xl border border-ga-border bg-ga-card p-6 shadow-ga-sm">
              <span className="inline-block rounded-ga-pill bg-ga-navy-soft px-3 py-0.5 text-ga-caption font-semibold text-ga-navy">
                {r.law}
              </span>
              <h3 className="mt-3 font-ga-display text-ga-m-h3 font-medium text-ga-ink">{r.name}</h3>
              <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-ga-body text-ga-ink">
                {r.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section id={STEPS_ANCHOR} className={`${SECTION} scroll-mt-24 border-t border-ga-border`}>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14">
          <div className="min-w-0">
            <h2 className={H2}>{c.steps.title}</h2>
            <p className="mb-7 mt-3 max-w-[640px] text-ga-m-lead text-ga-muted">{c.steps.intro}</p>
            <AusbildungChecklist copy={c.steps} />
          </div>
          <aside className="flex flex-col gap-5 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-ga-xl border border-ga-yellow bg-ga-yellow-soft p-6 shadow-ga-sm">
              <h3 className="font-ga-display text-ga-m-h3 font-medium text-ga-ink">{c.money.title}</h3>
              <p className="mt-2 text-ga-body text-ga-ink">{c.money.body}</p>
              <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-ga-small text-ga-ink">
                {c.money.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <section className={`${SECTION} border-t border-ga-border`}>
        <h2 className={H2}>{c.find.title}</h2>
        <p className="mt-3 max-w-[640px] text-ga-m-lead text-ga-muted">{c.find.intro}</p>
        <div className="mt-7 grid gap-5 md:grid-cols-2">
          {c.find.portals.map((p) => (
            <div key={p.url} className="rounded-ga-xl border border-ga-border bg-ga-card p-6 shadow-ga-sm">
              <h3 className="font-ga-display text-ga-m-h3 font-medium text-ga-ink">
                <ExternalLink href={p.url}>{p.name}</ExternalLink>
              </h3>
              <p className="mt-2 text-ga-body text-ga-muted">{p.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 rounded-ga-md border-l-4 border-ga-yellow bg-ga-card p-4 text-ga-body text-ga-muted">{c.find.warning}</p>
      </section>

      <section id={COMPANIES_ANCHOR} className={`${SECTION} scroll-mt-24 border-t border-ga-border`}>
        <h2 className={H2}>{c.companies.title}</h2>
        <p className="mb-7 mt-3 max-w-[640px] text-ga-m-lead text-ga-muted">{c.companies.intro}</p>
        <AusbildungCompanies copy={c.companies} companies={AUSBILDUNG_COMPANIES} />
      </section>

      <section id={OCCUPATIONS_ANCHOR} className={`${SECTION} scroll-mt-24 border-t border-ga-border`}>
        <h2 className={H2}>{c.occupations.title}</h2>
        <p className="mt-3 max-w-[640px] text-ga-m-lead text-ga-muted">{c.occupations.intro}</p>
        {!trades ? (
          <p className="mt-8 rounded-ga-md border-l-4 border-ga-yellow bg-ga-card p-4 text-ga-body text-ga-muted">
            {c.occupations.unavailable}
          </p>
        ) : (
          <div className="mt-8 flex flex-col gap-6">
            {WORKPLACES.map((w) => {
              const items = trades.filter((o) => o.workplace === w)
              if (!items.length) return null
              return (
                <div key={w} className="rounded-ga-xl border border-ga-border bg-ga-card p-5 shadow-ga-sm sm:p-6">
                  {c.companies.groups[w] && (
                    <h3 className="mb-3 font-ga-display text-ga-m-h3 font-medium text-ga-ink">{c.companies.groups[w]}</h3>
                  )}
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((o) => (
                      <li key={o.code}>
                        <Link
                          href={tradeHref(o.code)}
                          className="block min-h-11 rounded-ga-md border border-ga-border bg-ga-bg p-3.5 transition-colors hover:border-ga-ink"
                        >
                          <span className="block text-ga-body font-semibold text-ga-ink">{o.nameDe}</span>
                          <span className="mt-0.5 block text-ga-caption text-ga-muted">
                            {occupationName(o, locale)} · {formatYears(o.training, locale)} {c.occupations.yearsUnit} · {c.occupations.levelPrefix} {o.training.level}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className={`${SECTION} border-t border-ga-border`}>
        <div className="rounded-ga-xl border border-ga-ink bg-ga-ink p-6 text-ga-bg shadow-ga-md md:p-9">
          <h2 className="font-ga-display text-ga-m-h2-m font-medium text-ga-bg sm:text-ga-m-h2-t">{c.practice.title}</h2>
          <p className="mt-3 max-w-[640px] text-ga-m-lead text-ga-bg/85">{c.practice.body}</p>
          <GaBtn asChild variant="yellow" size="lg" className="ga-btn-gleam mt-6 w-full sm:w-auto">
            <Link href={START_HREF}>
              <span className="text-ga-body">{c.practice.cta}</span>
              <ArrowRight size={16} aria-hidden />
            </Link>
          </GaBtn>
        </div>

        <div className="mt-8 rounded-ga-xl border border-ga-border bg-ga-card p-5 sm:p-6">
          <p className="text-ga-body text-ga-muted">{c.disclaimer}</p>
          <p className="mt-2 text-ga-small text-ga-muted">
            {c.checkedLabel}: {AUSBILDUNG_CHECKED_AT}
          </p>
          <h2 className="mt-5 text-ga-body font-semibold text-ga-ink">{c.sourcesTitle}</h2>
          <ul className="mt-2 flex flex-col gap-1.5 text-ga-small text-ga-muted">
            {AUSBILDUNG_SOURCES.map((s) => (
              <li key={s.url}>
                <ExternalLink href={s.url}>{s.label}</ExternalLink>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </PublicShell>
  )
}

function formatYears(a: AusbildungOccupation, locale: AusbildungLocale): string {
  return locale === 'vi' ? String(a.years).replace('.', ',') : String(a.years)
}

/** Khối học nghề trên trang nghề. Chỉ hiện với nghề có Ausbildung và khi cổng nội dung đang mở. */
export function AusbildungOccupationBlock({
  training,
  locale,
}: {
  training: AusbildungOccupation
  locale: AusbildungLocale
}) {
  const c = AUSBILDUNG_COPY[locale]
  const b = c.occupationBlock
  const guideHref = withDraftPreview(publicHref(locale, AUSBILDUNG_PAGE) ?? `${AUSBILDUNG_PAGE}/`)
  return (
    <section aria-labelledby="ausbildung-block" className="mt-10 rounded-ga-xl border border-ga-border bg-ga-card p-6 shadow-ga-sm">
      {!AUSBILDUNG_CONTENT_REVIEWED && (
        <p role="status" className="mb-3 border-l-2 border-ga-yellow pl-3 text-ga-small font-semibold text-ga-ink">
          {c.draftBanner}
        </p>
      )}
      <h2 id="ausbildung-block" className="font-ga-display text-ga-m-h3 font-medium text-ga-ink">
        {b.cap}
      </h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-ga-md border border-ga-border bg-ga-bg p-3.5">
          <dt className="text-ga-caption text-ga-muted">{b.years}</dt>
          <dd className="text-ga-body font-semibold text-ga-ink">
            {formatYears(training, locale)} {c.occupations.yearsUnit}
          </dd>
        </div>
        <div className="rounded-ga-md border border-ga-border bg-ga-bg p-3.5">
          <dt className="text-ga-caption text-ga-muted">{b.level}</dt>
          <dd className="text-ga-body font-semibold text-ga-ink">{training.level}</dd>
        </div>
      </dl>
      <p className="mt-3 text-ga-small text-ga-muted">
        {b.paid}. {b.levelNote}
      </p>
      <div className="mt-4 flex flex-col gap-2 text-ga-body sm:flex-row sm:flex-wrap sm:gap-x-6">
        <ExternalLink href={jobsucheUrl(training.searchDe)}>{b.findBa}</ExternalLink>
        <ExternalLink href={ausbildungDeUrl(training.searchDe)}>{b.findAusbildungDe}</ExternalLink>
        <Link href={`${guideHref}#${COMPANIES_ANCHOR}`} className="font-medium text-ga-navy underline decoration-ga-yellow decoration-2 underline-offset-4 hover:text-ga-ink">
          {b.companies}
        </Link>
        <Link href={guideHref} className="font-semibold text-ga-navy underline decoration-ga-yellow decoration-2 underline-offset-4 hover:text-ga-ink">
          {b.guide}
        </Link>
      </div>
    </section>
  )
}
