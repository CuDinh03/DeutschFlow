import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { getLocale, getTranslations } from 'next-intl/server'
import { GaBtn } from '@/components/ui-v2/GaBtn'
import { DEFAULT_PUBLIC_LOCALE, isPublicLocale, localizedHref, type PublicLocale } from '@/lib/publicLocale'
import {
  WORKPLACES,
  occupationName,
  occupationTitleName,
  questionLabel,
  type IndexableOccupation,
  type OccupationDetail,
  type OccupationSummary,
  type QuestionSource,
  type Workplace,
} from '@/lib/occupationTypes'
import { ausbildungOccupation } from '@/lib/ausbildung'
import { isAusbildungLocale } from '@/lib/ausbildungGate'
import { AusbildungOccupationBlock } from './AusbildungPage'
import { InterviewerPortrait } from './PersonaPortrait'
import { OccupationIndexFilter } from './OccupationIndexFilter'
import { PublicShell } from './PublicShell'
import { PUBLIC_V3_ASSETS } from './publicV3Assets'
import { QualityLabel } from './QualityLabel'
import { QuestionTranslation } from './QuestionTranslation'
import { interviewerInfo } from './interviewerInfo'
import { START_HREF } from './links'
import { examForWorkplace, exampleQuestion, guideForOccupation, relatedOccupations, tidyQuotedSentenceEnd } from '@/lib/occupationRelated'
import { toJsonLd } from '@/lib/homeStructuredData'

/**
 * Trang phỏng vấn theo nghề (nâng cấp v3.4 — 14/11/2026):
 * - Trang tổng `/phong-van/`: Hero minh họa 3D nhân vật ngành Bếp & Điều dưỡng, bộ lọc nhanh 8 nhóm ngành
 *   và tách rõ nghề đã duyệt (`CURATED`) lên đầu, gom nghề mở rộng vào `<details>` để bảo vệ crawl budget & gọn mobile.
 * - Trang chi tiết `/phong-van/[nghe]/`: Nút luyện ngay dưới `<h1>` trên mobile 390px, thu gọn câu hỏi từ số 3
 *   trong `<details>` trên điện thoại, tô màu mạo từ tiếng Đức `der` (xanh navy) · `die` (đỏ) · `das` (vàng),
 *   giữ nguyên cơ chế `serverBackendFetch` và `FAQPage` JSON-LD.
 */

const YellowSq = ({ dark = false }: { dark?: boolean }) => (
  <span className={`inline-block h-[7px] w-[7px] shrink-0 ${dark ? 'bg-ga-ink' : 'bg-ga-yellow'}`} />
)

async function publicLocale(): Promise<PublicLocale> {
  const raw = await getLocale()
  return isPublicLocale(raw) ? raw : DEFAULT_PUBLIC_LOCALE
}

function GermanTermBadge({ termDe }: { termDe: string }) {
  const match = /^(der|die|das)\s+(.+)$/i.exec(termDe.trim())
  if (!match) {
    return <span lang="de" className="text-ga-body font-semibold text-ga-ink">{termDe}</span>
  }
  const article = match[1].toLowerCase()
  const rest = match[2]
  const tone =
    article === 'der'
      ? 'border-ga-navy bg-ga-navy-soft text-ga-navy'
      : article === 'die'
        ? 'border-ga-red bg-ga-red-soft text-ga-red'
        : 'border-ga-gold bg-ga-yellow-soft text-ga-ink'
  return (
    <span lang="de" className="inline-flex flex-wrap items-center gap-1.5 text-ga-body font-semibold text-ga-ink">
      <span className={`rounded-ga-pill border px-2 py-0.5 text-ga-caption font-bold ${tone}`}>
        {match[1]}
      </span>
      <span>{rest}</span>
    </span>
  )
}

export async function OccupationIndex({ occupations }: { occupations: OccupationSummary[] | null }) {
  const t = await getTranslations('v2.landing')
  const locale = await publicLocale()

  const workplaceLabels = Object.fromEntries(
    WORKPLACES.map((w) => [w, t(`workplaces.${w}`)]),
  ) as Record<Workplace, string>

  return (
    <PublicShell
      current="interview"
      stickyCta="b2c"
      mainClassName="mx-auto w-full max-w-[1240px] px-5 pb-20 pt-8 sm:px-8 md:pt-14 lg:px-[60px]"
    >
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-ga-pill border border-ga-border bg-ga-card px-3.5 py-1.5 text-ga-eyebrow uppercase text-ga-ink shadow-ga-sm">
            <YellowSq />{t('occupationPages.index.cap')}
          </div>
          <h1 className="max-w-[820px] font-ga-display text-ga-m-h1-m sm:text-ga-m-h1-t lg:text-ga-m-h1 text-ga-ink">
            {t('occupationPages.index.title')}
          </h1>
          <p className="mt-4 max-w-[640px] text-ga-m-lead text-ga-muted">
            {t('occupationPages.index.intro')}
          </p>
        </div>

        <div aria-hidden className="hidden grid-cols-2 gap-3 lg:grid">
          <div className="overflow-hidden rounded-ga-lg border border-ga-border bg-ga-card p-2 shadow-ga-sm">
            <Image
              src={PUBLIC_V3_ASSETS.kruegerPflege3d}
              alt=""
              sizes="160px"
              className="aspect-square h-auto w-full rounded-ga-md object-cover"
            />
          </div>
          <div className="overflow-hidden rounded-ga-lg border border-ga-border bg-ga-card p-2 shadow-ga-sm">
            <Image
              src={PUBLIC_V3_ASSETS.klausKueche3d}
              alt=""
              sizes="160px"
              className="aspect-square h-auto w-full rounded-ga-md object-cover"
            />
          </div>
        </div>
      </div>

      {!occupations ? (
        <p className="mt-10 rounded-ga-md border-l-4 border-ga-yellow bg-ga-card p-4 text-ga-body text-ga-muted shadow-ga-sm">
          {t('occupationPages.index.unavailable')}
        </p>
      ) : (
        <OccupationIndexFilter
          occupations={occupations}
          locale={locale}
          workplaceLabels={workplaceLabels}
          labels={{
            filterAll: t('occupationPages.index.filterAll'),
            searchLabel: t('occupationPages.index.searchLabel'),
            searchPlaceholder: t('occupationPages.index.searchPlaceholder'),
            curatedCap: t('occupationPages.index.curatedCap'),
            extendedSummary: t('occupationPages.index.extendedSummary', { count: '{count}' }),
            countTpl: t('occupationPages.index.count', { count: '{count}' }),
          }}
        />
      )}
    </PublicShell>
  )
}

export async function OccupationDetailView({
  detail,
  showTraining = false,
  catalog = null,
  indexable = null,
}: {
  detail: OccupationDetail
  showTraining?: boolean
  catalog?: OccupationSummary[] | null
  indexable?: IndexableOccupation[] | null
}) {
  const t = await getTranslations('v2.landing')
  const locale = await publicLocale()
  const o = detail.occupation
  const who = interviewerInfo(detail.personaCode)
  const label = (source: QuestionSource) => questionLabel(source, o.questionSet)
  const sampleTexts = new Set(detail.sampleQuestions.map((q) => q.questionDe))
  const more = detail.occupationQuestions.filter((q) => !sampleTexts.has(q.questionDe))
  const startHref = `${START_HREF}/?occupation=${encodeURIComponent(o.code)}`
  const training = showTraining ? ausbildungOccupation(o.code) : null
  const related = relatedOccupations(o, catalog, indexable)
  const guide = locale === 'vi' ? guideForOccupation(o.code) : undefined
  const exam = locale === 'vi' ? examForWorkplace(o.workplace) : undefined
  const faqName = locale === 'de' ? o.nameDe : occupationTitleName(o, locale)
  const example = exampleQuestion(detail)
  const faqs = [
    {
      q: t('occupationPages.detail.faqAskQ', { name: faqName }),
      a: example
        ? tidyQuotedSentenceEnd(t('occupationPages.detail.faqAskA', { example }))
        : t('occupationPages.detail.faqAskANoExample'),
    },
    { q: t('occupationPages.detail.faqLevelQ', { name: faqName }), a: t('occupationPages.detail.faqLevelA') },
    { q: t('occupationPages.detail.faqCostQ', { name: faqName }), a: t('occupationPages.detail.faqCostA') },
  ]
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }

  const headQuestions = detail.sampleQuestions.slice(0, 2)
  const foldedQuestions = detail.sampleQuestions.slice(2)

  const renderSampleQuestion = (q: OccupationDetail['sampleQuestions'][number], idx: number) => (
    <li key={idx} className="flex items-start gap-3.5 rounded-ga-lg border border-ga-border bg-ga-card p-4 shadow-ga-sm sm:p-5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-ga-pill bg-ga-yellow-soft font-ga-display text-ga-body font-bold text-ga-ink">
        {idx + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p lang="de" className="font-ga-display text-ga-body-lg italic text-ga-ink">„{q.questionDe}“</p>
        <QuestionTranslation q={q} locale={locale} className="mt-1.5 text-ga-body" />
        <div className="mt-2">
          <QualityLabel kind={label(q.source)} text={t(`explorer.labels.${label(q.source)}`)} />
        </div>
      </div>
    </li>
  )

  return (
    <PublicShell
      current="interview"
      stickyCta="b2c"
      mainClassName="mx-auto w-full max-w-[1240px] px-5 pb-20 pt-8 sm:px-8 md:pt-14 lg:px-[60px]"
    >
      <Link
        href={localizedHref(locale, '/phong-van')}
        className="mb-5 inline-flex min-h-11 items-center gap-2 text-ga-small font-semibold text-ga-muted hover:text-ga-ink"
      >
        <ArrowLeft size={16} aria-hidden />{t('occupationPages.detail.back')}
      </Link>

      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_330px] md:gap-14">
        <div className="min-w-0">
          <div className="mb-4 inline-flex items-center gap-2 rounded-ga-pill border border-ga-border bg-ga-card px-3.5 py-1.5 text-ga-eyebrow uppercase text-ga-ink shadow-ga-sm">
            <YellowSq />{t('occupationPages.index.cap')}
          </div>
          <h1 className="font-ga-display text-ga-m-h1-m sm:text-ga-m-h1-t lg:text-ga-m-h1 text-ga-ink">
            {t('occupationPages.detail.title', { nameDe: o.nameDe, name: occupationTitleName(o, locale) })}
          </h1>
          <p className="mt-3 text-ga-m-lead text-ga-muted">
            {t('occupationPages.detail.subtitle', { name: occupationName(o, locale), workplace: t(`workplaces.${o.workplace}`) })}
          </p>

          {/* Màn đầu 390px: Thẻ người phỏng vấn gọn + CTA vàng ngay dưới H1 */}
          <div className="mt-6 flex flex-col gap-3 md:hidden">
            {who && (
              <div className="flex items-center gap-3.5 rounded-ga-lg border border-ga-border bg-ga-card p-3.5 shadow-ga-sm">
                <InterviewerPortrait personaCode={detail.personaCode} className="w-14 shrink-0" tint={0.24} />
                <div className="min-w-0">
                  <div className="text-ga-caption font-semibold uppercase text-ga-muted">{t('occupationPages.detail.interviewer')}</div>
                  <div className="truncate text-ga-h3 text-ga-ink">{who.name}</div>
                  <div className="truncate text-ga-caption text-ga-muted">
                    {who.kind === 'workplace' ? t(`interviewerRoles.${who.roleKey}`) : who.tag}
                  </div>
                </div>
              </div>
            )}
            <GaBtn asChild variant="yellow" size="lg" className="ga-btn-gleam w-full">
              <Link href={startHref}>
                <YellowSq dark />
                <span className="text-ga-body font-semibold">{t('occupationPages.detail.cta')}</span>
              </Link>
            </GaBtn>
            <p className="text-ga-caption text-ga-muted">{t('occupationPages.detail.ctaNote')}</p>
          </div>

          <h2 className="mb-4 mt-10 font-ga-display text-ga-h2 text-ga-ink">{t('occupationPages.detail.questionsCap')}</h2>
          <ol className="flex flex-col gap-3.5">
            {headQuestions.map((q, i) => renderSampleQuestion(q, i))}
          </ol>

          {foldedQuestions.length > 0 && (
            <>
              {/* Trên desktop hiện liền mạch; trên điện thoại thu gọn từ câu thứ 3 trong <details> (mọi câu vẫn nằm trong DOM SEO) */}
              <ol start={3} className="mt-3.5 hidden flex-col gap-3.5 md:flex">
                {foldedQuestions.map((q, i) => renderSampleQuestion(q, i + 2))}
              </ol>
              <details className="group mt-3.5 rounded-ga-lg border border-ga-border bg-ga-surface-2 p-4 md:hidden">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-ga-small font-semibold text-ga-ink [&::-webkit-details-marker]:hidden">
                  <span>{t('occupationPages.detail.moreFoldSummary', { count: foldedQuestions.length })}</span>
                  <ChevronDown size={16} aria-hidden className="shrink-0 text-ga-muted transition-transform group-open:rotate-180" />
                </summary>
                <ol start={3} className="mt-3 flex flex-col gap-3">
                  {foldedQuestions.map((q, i) => renderSampleQuestion(q, i + 2))}
                </ol>
              </details>
            </>
          )}

          {more.length > 0 && (
            <>
              <h2 className="mb-4 mt-10 font-ga-display text-ga-h2 text-ga-ink">{t('occupationPages.detail.moreCap')}</h2>
              <ul className="flex flex-col gap-3">
                {more.map((q, i) => (
                  <li key={i} className="flex flex-col gap-2 rounded-ga-md border border-ga-border bg-ga-card p-4 shadow-ga-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <p lang="de" className="text-ga-body font-medium text-ga-ink">„{q.questionDe}“</p>
                      <QuestionTranslation q={q} locale={locale} className="mt-0.5 text-ga-small" />
                    </div>
                    <QualityLabel kind={label(q.status)} text={t(`explorer.labels.${label(q.status)}`)} />
                  </li>
                ))}
              </ul>
            </>
          )}

          {(detail.terms.length > 0 || guide) && (
            <h2 className="mb-4 mt-10 font-ga-display text-ga-h2 text-ga-ink">{t('occupationPages.detail.termsCap')}</h2>
          )}
          {detail.terms.length === 0 ? (
            guide ? (
              <p className="text-ga-body text-ga-muted">
                {t.rich('occupationPages.detail.termsGuide', {
                  title: guide.title,
                  link: (chunks) => (
                    <Link href={`/cam-nang/${guide.slug}/`} className="font-medium text-ga-navy underline decoration-ga-yellow decoration-2 underline-offset-4 hover:decoration-ga-ink">
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            ) : null
          ) : (
            <dl className="grid gap-3.5 sm:grid-cols-2">
              {detail.terms.map((term) => (
                <div key={term.termDe} className="rounded-ga-md border border-ga-border bg-ga-card p-4 shadow-ga-sm">
                  <dt><GermanTermBadge termDe={term.termDe} /></dt>
                  <dd className="mt-1.5 text-ga-small text-ga-muted">
                    {locale === 'de' ? term.exampleDe ?? '' : locale === 'en' ? term.meaningEn : term.meaningVi}
                  </dd>
                  <dd className="mt-2">
                    <QualityLabel kind={label(term.status)} text={t(`explorer.labels.${label(term.status)}`)} />
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <p className="mt-8 rounded-ga-md border-l-4 border-ga-yellow bg-ga-card px-4 py-3 text-ga-small text-ga-muted shadow-ga-sm">
            {t('occupationPages.detail.labelsNote')}
          </p>

          <section aria-labelledby="occ-faq" className="mt-10">
            <h2 id="occ-faq" className="mb-4 font-ga-display text-ga-h2 text-ga-ink">{t('occupationPages.detail.faqCap')}</h2>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(faqLd) }} />
            <div className="divide-y divide-ga-border rounded-ga-lg border border-ga-border bg-ga-card px-5 shadow-ga-sm">
              {faqs.map((f) => (
                <details key={f.q} className="group">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 text-ga-body font-semibold text-ga-ink [&::-webkit-details-marker]:hidden">
                    <span>{f.q}</span>
                    <ChevronDown size={16} aria-hidden className="shrink-0 text-ga-muted transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="pb-4 text-ga-body text-ga-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          {(related.length > 0 || guide || exam) && (
            <section aria-labelledby="occ-related" className="mt-10">
              <h2 id="occ-related" className="mb-4 font-ga-display text-ga-h2 text-ga-ink">{t('occupationPages.detail.relatedCap')}</h2>
              {related.length > 0 && (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {related.map((r) => (
                    <li key={r.code}>
                      <Link
                        href={localizedHref(locale, `/phong-van/${r.code}`)}
                        className="block min-h-11 rounded-ga-md border border-ga-border bg-ga-card px-4 py-3 shadow-ga-sm transition-colors hover:border-ga-ink"
                      >
                        <span className="block text-ga-body font-semibold text-ga-ink">{r.nameDe}</span>
                        {locale !== 'de' && <span className="block text-ga-caption text-ga-muted">{occupationName(r, locale)}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {(guide || exam) && (
                <ul className="mt-4 flex flex-col gap-2">
                  {guide && (
                    <li>
                      <Link href={`/cam-nang/${guide.slug}/`} className="text-ga-body font-medium text-ga-navy underline decoration-ga-yellow decoration-2 underline-offset-4 hover:decoration-ga-ink">
                        {t('occupationPages.detail.guideLink', { title: guide.title })}
                      </Link>
                    </li>
                  )}
                  {exam && (
                    <li>
                      <Link href={`/luyen-thi/${exam.slug}/`} className="text-ga-body font-medium text-ga-navy underline decoration-ga-yellow decoration-2 underline-offset-4 hover:decoration-ga-ink">
                        {t('occupationPages.detail.examLink', { name: exam.name })}
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </section>
          )}

          {training && isAusbildungLocale(locale) && (
            <AusbildungOccupationBlock training={training} locale={locale} />
          )}
        </div>

        <aside className="hidden flex-col gap-5 md:sticky md:top-24 md:flex md:self-start">
          {who && (
            <div className="rounded-ga-xl border border-ga-border-strong bg-ga-card p-5 shadow-ga-md">
              <div className="mb-3 text-ga-eyebrow uppercase text-ga-muted">{t('occupationPages.detail.interviewer')}</div>
              <div className="flex items-center gap-4">
                <InterviewerPortrait personaCode={detail.personaCode} className="w-[84px] shrink-0" tint={0.24} />
                <div className="min-w-0">
                  <div className="text-ga-h3 text-ga-ink">{who.name}</div>
                  <div className="text-ga-caption text-ga-muted">
                    {who.kind === 'workplace' ? t(`interviewerRoles.${who.roleKey}`) : who.tag}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="rounded-ga-xl border border-ga-border-strong bg-ga-ink p-5 text-ga-bg shadow-ga-md">
            <GaBtn asChild variant="yellow" size="lg" className="ga-btn-gleam w-full">
              <Link href={startHref}>
                <YellowSq dark />
                <span className="text-ga-body font-semibold">{t('occupationPages.detail.cta')}</span>
              </Link>
            </GaBtn>
            <p className="mt-3 text-ga-small text-ga-subtle">{t('occupationPages.detail.ctaNote')}</p>
          </div>
        </aside>
      </div>
    </PublicShell>
  )
}
