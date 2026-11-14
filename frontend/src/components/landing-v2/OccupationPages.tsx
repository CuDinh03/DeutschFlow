import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
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
} from '@/lib/occupationTypes'
import { LandingHeader } from './LandingHeader'
import { ausbildungOccupation } from '@/lib/ausbildung'
import { isAusbildungLocale } from '@/lib/ausbildungGate'
import { AusbildungOccupationBlock } from './AusbildungPage'
import { LandingFooter } from './LandingFooter'
import { InterviewerPortrait } from './PersonaPortrait'
import { QualityLabel } from './QualityLabel'
import { QuestionTranslation } from './QuestionTranslation'
import { interviewerInfo } from './interviewerInfo'
import { START_HREF } from './links'
import { examForWorkplace, exampleQuestion, guideForOccupation, relatedOccupations } from '@/lib/occupationRelated'
import { toJsonLd } from '@/lib/homeStructuredData'

/**
 * Trang phỏng vấn theo nghề (đợt 2d A+B+E): trang tổng `/phong-van/` và trang từng nghề
 * `/phong-van/[nghe]/`, ba thứ tiếng theo URL. Server component — nội dung nằm sẵn trong HTML cho
 * máy tìm kiếm. Mỗi câu hỏi mang nhãn thật: Đã duyệt / AI tạo / Bộ câu hỏi chung (sổ lời hứa).
 */

const YellowSq = () => <span className="inline-block h-[7px] w-[7px] shrink-0 bg-ga-yellow" />

async function publicLocale(): Promise<PublicLocale> {
  const raw = await getLocale()
  return isPublicLocale(raw) ? raw : DEFAULT_PUBLIC_LOCALE
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-clip bg-ga-bg font-ga-ui text-ga-ink">
      <LandingHeader current="interview" />
      <main className="mx-auto max-w-[1240px] px-5 pb-16 pt-10 sm:px-8 md:pt-14 lg:px-[60px]">{children}</main>
      <LandingFooter />
    </div>
  )
}

export async function OccupationIndex({ occupations }: { occupations: OccupationSummary[] | null }) {
  const t = await getTranslations('v2.landing')
  const locale = await publicLocale()

  return (
    <Shell>
      <div className="mb-[22px] inline-flex items-center gap-2 text-ga-eyebrow uppercase text-ga-muted">
        <YellowSq />{t('occupationPages.index.cap')}
      </div>
      <h1 className="max-w-[820px] font-ga-display text-ga-h1-m font-medium leading-[1.08] sm:text-ga-h1">
        {t('occupationPages.index.title')}
      </h1>
      <p className="mt-5 max-w-[640px] text-ga-body-lg text-ga-muted">{t('occupationPages.index.intro')}</p>

      {!occupations ? (
        <p className="mt-10 border-l-2 border-ga-yellow pl-3 text-ga-body text-ga-muted">
          {t('occupationPages.index.unavailable')}
        </p>
      ) : (
        <div className="mt-10 flex flex-col gap-10">
          {WORKPLACES.map((w) => {
            const items = occupations.filter((o) => o.workplace === w)
            if (!items.length) return null
            return (
              <section key={w} aria-labelledby={`wp-${w}`}>
                <div className="mb-4 flex flex-wrap items-baseline gap-x-3 border-b border-ga-border pb-2">
                  <h2 id={`wp-${w}`} className="text-ga-h3 text-ga-ink">{t(`workplaces.${w}`)}</h2>
                  <span className="text-ga-caption text-ga-muted">
                    {t('occupationPages.index.count', { count: items.length })}
                  </span>
                </div>
                <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((o) => (
                    <li key={o.code}>
                      <Link
                        href={localizedHref(locale, `/phong-van/${o.code}`)}
                        className="block min-h-11 py-2 hover:text-ga-navy"
                      >
                        <span className="block text-ga-body font-semibold">{o.nameDe}</span>
                        {locale !== 'de' && (
                          <span className="block text-ga-caption text-ga-muted">{occupationName(o, locale)}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </Shell>
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
  /** Danh mục nghề + danh sách lập chỉ mục cho khối "Nghề liên quan" (SEO cụm chủ đề); `null` = ẩn khối. */
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
  // Cẩm nang và trang luyện thi chỉ có tiếng Việt.
  const guide = locale === 'vi' ? guideForOccupation(o.code) : undefined
  const exam = locale === 'vi' ? examForWorkplace(o.workplace) : undefined
  // Câu trả lời ngắn ngay dưới câu hỏi (SEO 13/11/2026): lấy từ dữ liệu thật của trang, không bịa.
  const faqName = locale === 'de' ? o.nameDe : occupationTitleName(o, locale)
  const example = exampleQuestion(detail)
  const faqs = [
    {
      q: t('occupationPages.detail.faqAskQ', { name: faqName }),
      a: example
        ? t('occupationPages.detail.faqAskA', { example })
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

  return (
    <Shell>
      <Link
        href={localizedHref(locale, '/phong-van')}
        className="mb-6 inline-flex min-h-11 items-center gap-2 text-ga-small font-semibold text-ga-muted hover:text-ga-ink"
      >
        <ArrowLeft size={16} aria-hidden />{t('occupationPages.detail.back')}
      </Link>

      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_320px] md:gap-14">
        <div className="min-w-0">
          <div className="mb-[18px] inline-flex items-center gap-2 text-ga-eyebrow uppercase text-ga-muted">
            <YellowSq />{t('occupationPages.index.cap')}
          </div>
          <h1 className="font-ga-display text-ga-h1-m font-medium leading-[1.08] sm:text-ga-h1">
            {t('occupationPages.detail.title', { nameDe: o.nameDe, name: occupationTitleName(o, locale) })}
          </h1>
          <p className="mt-3 text-ga-body-lg text-ga-muted">
            {t('occupationPages.detail.subtitle', { name: occupationName(o, locale), workplace: t(`workplaces.${o.workplace}`) })}
          </p>
          {/* Đợt 1 (14/11/2026): dưới md cột phải (nút luyện) rơi xuống cuối trang — hiện nút ngay dưới H1. */}
          <div className="mt-6 md:hidden">
            <GaBtn asChild variant="ink" size="lg" className="w-full">
              <Link href={startHref}>
                <span className="text-ga-body">{t('occupationPages.detail.cta')}</span>
              </Link>
            </GaBtn>
          </div>

          <h2 className="mb-4 mt-10 text-ga-h3 text-ga-ink">{t('occupationPages.detail.questionsCap')}</h2>
          <ol className="flex flex-col gap-4">
            {detail.sampleQuestions.map((q, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="shrink-0 font-ga-display text-ga-body-lg font-semibold text-ga-gold">{i + 1}</span>
                <div className="min-w-0">
                  <p lang="de" className="font-ga-display text-ga-body-lg italic text-ga-ink">„{q.questionDe}“</p>
                  <QuestionTranslation q={q} locale={locale} className="mt-1 text-ga-body" />
                  <div className="mt-1.5">
                    <QualityLabel kind={label(q.source)} text={t(`explorer.labels.${label(q.source)}`)} />
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {more.length > 0 && (
            <>
              <h2 className="mb-4 mt-10 text-ga-h3 text-ga-ink">{t('occupationPages.detail.moreCap')}</h2>
              <ul className="flex flex-col gap-3">
                {more.map((q, i) => (
                  <li key={i} className="flex flex-col gap-1.5 border-b border-ga-border pb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <p lang="de" className="text-ga-body text-ga-ink">„{q.questionDe}“</p>
                      <QuestionTranslation q={q} locale={locale} className="mt-0.5 text-ga-small" />
                    </div>
                    <QualityLabel kind={label(q.status)} text={t(`explorer.labels.${label(q.status)}`)} />
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Đợt 1 (14/11/2026): nghề chưa có từ chuyên môn thì không để lộ mục rỗng "đang được soạn" — có bài
              Cẩm nang cùng nghề (bản vi) thì dẫn sang đó, không thì ẩn hẳn mục. */}
          {(detail.terms.length > 0 || guide) && (
            <h2 className="mb-4 mt-10 text-ga-h3 text-ga-ink">{t('occupationPages.detail.termsCap')}</h2>
          )}
          {detail.terms.length === 0 ? (
            guide ? (
              <p className="text-ga-body text-ga-muted">
                {t.rich('occupationPages.detail.termsGuide', {
                  title: guide.title,
                  link: (chunks) => (
                    <Link href={`/cam-nang/${guide.slug}/`} className="text-ga-ink underline decoration-ga-yellow decoration-2 underline-offset-4 hover:decoration-ga-ink">
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            ) : null
          ) : (
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {detail.terms.map((term) => (
                <div key={term.termDe} className="border-l-2 border-ga-border pl-3">
                  <dt lang="de" className="text-ga-body font-semibold text-ga-ink">{term.termDe}</dt>
                  <dd className="text-ga-small text-ga-muted">
                    {locale === 'de' ? term.exampleDe ?? '' : locale === 'en' ? term.meaningEn : term.meaningVi}
                  </dd>
                  <dd className="mt-1">
                    <QualityLabel kind={label(term.status)} text={t(`explorer.labels.${label(term.status)}`)} />
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <p className="mt-10 border-l-2 border-ga-yellow pl-3 text-ga-small text-ga-muted">
            {t('occupationPages.detail.labelsNote')}
          </p>

          <section aria-labelledby="occ-faq">
            <h2 id="occ-faq" className="mb-4 mt-10 text-ga-h3 text-ga-ink">{t('occupationPages.detail.faqCap')}</h2>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(faqLd) }} />
            <div className="border-t border-ga-border">
              {faqs.map((f) => (
                <div key={f.q} className="border-b border-ga-border py-4">
                  <h3 className="text-ga-body font-semibold text-ga-ink">{f.q}</h3>
                  <p className="mt-1.5 text-ga-body text-ga-muted">{f.a}</p>
                </div>
              ))}
            </div>
          </section>

          {(related.length > 0 || guide || exam) && (
            <section aria-labelledby="occ-related" className="mt-10">
              <h2 id="occ-related" className="mb-4 text-ga-h3 text-ga-ink">{t('occupationPages.detail.relatedCap')}</h2>
              {related.length > 0 && (
                <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                  {related.map((r) => (
                    <li key={r.code}>
                      <Link href={localizedHref(locale, `/phong-van/${r.code}`)} className="block min-h-11 py-2 hover:text-ga-navy">
                        <span className="block text-ga-body font-semibold">{r.nameDe}</span>
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
                      <Link href={`/cam-nang/${guide.slug}/`} className="text-ga-body text-ga-ink underline decoration-ga-yellow decoration-2 underline-offset-4 hover:decoration-ga-ink">
                        {t('occupationPages.detail.guideLink', { title: guide.title })}
                      </Link>
                    </li>
                  )}
                  {exam && (
                    <li>
                      <Link href={`/luyen-thi/${exam.slug}/`} className="text-ga-body text-ga-ink underline decoration-ga-yellow decoration-2 underline-offset-4 hover:decoration-ga-ink">
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

        <aside className="flex flex-col gap-6 md:sticky md:top-28 md:self-start">
          {who && (
            <div className="border border-ga-border bg-ga-card p-5">
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
          <div className="border border-ga-border bg-ga-card p-5">
            <GaBtn asChild variant="ink" size="lg" className="w-full">
              <Link href={startHref}>
                <span className="text-ga-body">{t('occupationPages.detail.cta')}</span>
              </Link>
            </GaBtn>
            <p className="mt-3 text-ga-small text-ga-muted">{t('occupationPages.detail.ctaNote')}</p>
          </div>
        </aside>
      </div>
    </Shell>
  )
}
