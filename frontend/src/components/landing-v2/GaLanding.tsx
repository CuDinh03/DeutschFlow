'use client'

import * as React from 'react'
import Image from 'next/image'
import { useTracking } from '@/hooks/useTracking'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import { GaBtn, GaCap } from '@/components/ui-v2'
import { GaGlyphMark } from '@/components/ui-v2/GaGlyphMark'
import type { GlyphName } from '@/lib/galerieGlyphs'
import { DEFAULT_PUBLIC_LOCALE, isPublicLocale, publicHref } from '@/lib/publicLocale'
import { AppStoreHeroLink, AppStoreLearnRow } from './AppDownload'
import { BrandPillars } from './BrandPillars'
import { ExamClip } from './ExamClip'
import { GaShot } from './GaShot'
import { MobileStickyCta } from './MobileStickyCta'
import { OccupationExplorer } from './OccupationExplorer'
import { CastSection } from './CastSection'
import { PlansPreviewBand } from './PlansPreviewBand'
import { PUBLIC_V3_ASSETS } from './publicV3Assets'
import { SocialProof } from './SocialProof'
import { PathwayTabs, type Pathway } from './PathwayTabs'
import { FounderBand } from './FounderBand'
import { LandingFooter } from './LandingFooter'
import { LandingHeader } from './LandingHeader'
import { SentenceFix } from './SentenceFix'
import { START_HREF, SUPPORT_EMAIL } from './links'

/**
 * GaLanding — trang chủ công khai cho NGƯỜI HỌC (nhóm B), render ở `/`, `/en/`, `/de/` và `/v2`.
 *
 * Nâng cấp v3.4 Warm Modern German EdTech (14/11/2026):
 * - Bọc `.ga-scope.ga-public` kích hoạt nền giấy kem ấm, bo góc v3.4 và thanh CTA dính đáy `MobileStickyCta`.
 * - Màn 1 điện thoại (390px): đưa thẳng `OccupationExplorer` lên ngay dưới `<h1>` + `sub` (không cần cuộn dài),
 *   kèm phông nền bình minh sông Rhein (Kölner Dom mờ sương) và dải 4 trụ cột thương hiệu `BrandPillars`.
 * - Khối `#report` giữ nguyên vị trí anh em kế tiếp `#interview` (`hero.nextElementSibling === report`),
 *   bổ sung thanh điểm `.ga-bar-grow`.
 * - Khối `PlansPreviewBand` đọc nguồn đơn nhất từ `@/data/chiPhiPage` (không tạo bảng giá lệch, không dùng băng ảnh marquee).
 */

const YellowSq = ({ dark = false }: { dark?: boolean }) => (
  <span className={`inline-block h-[7px] w-[7px] shrink-0 ${dark ? 'bg-ga-ink' : 'bg-ga-yellow'}`} />
)

const EXAM_DE = ['Lesen', 'Hören', 'Schreiben', 'Sprechen']
const EXAM_GLYPHS: GlyphName[] = ['doc', 'nghe', 'viet', 'noi']
const LEARN_GLYPHS: GlyphName[] = ['lernweg', 'srs', 'video', 'thongke']
const PATHWAY_COLORS = ['var(--ga-yellow)', 'var(--ga-red)', 'var(--ga-blue)', 'var(--ga-violet)', 'var(--ga-green)']
type ExamPart = { name: string; time: string; body: string }
type Phase = { name: string; score: string }
type Learn = { name: string; desc: string }
type Faq = { q: string; a: string }

const SECTION = 'mx-auto max-w-[1240px] px-5 py-12 sm:px-8 md:py-[72px] lg:px-[60px]'
const SHOT_HALF_SIZES = '(min-width: 1240px) 600px, (min-width: 1024px) 50vw, (min-width: 768px) calc(100vw - 64px), 720px'
const H2 = 'font-ga-display text-ga-m-h2-m sm:text-ga-m-h2-t lg:text-ga-m-h2 text-ga-ink'

export function GaLanding() {
  const t = useTranslations('v2.landing')
  const raw = <T,>(key: string): T => t.raw(key) as T
  const rawLocale = useLocale()
  const locale = isPublicLocale(rawLocale) ? rawLocale : DEFAULT_PUBLIC_LOCALE
  const centersHref = publicHref(locale, '/trung-tam') ?? publicHref('en', '/trung-tam') ?? '/trung-tam/'

  const examParts = raw<ExamPart[]>('exam.parts')
  const heroBullets = raw<string[]>('hero.bullets')
  const pathways = raw<Pathway[]>('pathways.items')
  const phases = raw<Phase[]>('report.phases')
  const strengths = raw<string[]>('report.strengths')
  const gaps = raw<string[]>('report.gaps')
  const drills = raw<string[]>('report.drills')
  const learnItems = raw<Learn[]>('learn.items')
  const faqs = raw<Faq[]>('faq.items')

  const { trackEvent } = useTracking()
  const trackCta = React.useCallback(
    (placement: string) => trackEvent('landing_cta_clicked', { placement }),
    [trackEvent],
  )
  const trackOccupation = React.useCallback(
    (positionId: string) => trackEvent('landing_occupation_selected', { position: positionId }),
    [trackEvent],
  )

  const showExamClip = locale === 'vi'
  const examGrid = (
    <div className={`grid grid-cols-2 gap-3 md:grid-cols-4 ${showExamClip ? 'lg:grid-cols-2' : ''}`}>
      {examParts.map((p, i) => (
        <div
          key={i}
          className="rounded-ga-md border border-ga-border bg-ga-card p-4 shadow-ga-sm sm:p-6"
        >
          <GaGlyphMark name={EXAM_GLYPHS[i]} size={32} draw="view" className="mb-3 block text-ga-ink" />
          <div className="mb-0.5 font-ga-display text-ga-h2 text-ga-ink">{EXAM_DE[i]}</div>
          <div className="mb-3 text-ga-caption text-ga-muted">{p.name} · {p.time}</div>
          <p className="text-ga-small text-ga-muted">{p.body}</p>
        </div>
      ))}
    </div>
  )
  const examDisclaimer = (
    <p className="mt-4 flex items-start gap-2.5 text-ga-small text-ga-muted">
      <span className="mt-1.5 inline-block h-[7px] w-[7px] shrink-0 bg-ga-yellow" />
      <span>
        {t('exam.disclaimer')}{' '}
        <Link href="/luyen-thi" className="font-medium text-ga-ink underline decoration-ga-yellow decoration-2 underline-offset-4">{t('exam.guideLink')}</Link>
      </span>
    </p>
  )

  const faqLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }).replace(/</g, '\\u003c')

  return (
    <div className="ga-scope ga-public min-h-screen overflow-x-clip scroll-smooth bg-ga-bg font-ga-ui text-ga-ink">
      {/* S1 — Nav dùng chung */}
      <LandingHeader />

      <main>

      {/* S2 + S3 — Hero bình minh sông Rhein + ô tìm nghề ở ngay màn đầu điện thoại + 4 trụ cột thương hiệu */}
      <section id="interview" className="relative isolate scroll-mt-[78px] overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <Image
            src={PUBLIC_V3_ASSETS.koelnMistHero}
            alt=""
            priority
            sizes="100vw"
            className="df-mist-drift h-full w-full object-cover object-center opacity-20"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, color-mix(in srgb, var(--ga-bg) 72%, transparent) 0%, color-mix(in srgb, var(--ga-bg) 92%, transparent) 68%, var(--ga-bg) 100%)',
            }}
          />
        </div>

        <div className="mx-auto grid max-w-[1240px] grid-cols-[minmax(0,1fr)] items-start gap-7 px-5 pb-12 pt-7 sm:px-8 sm:pt-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-x-14 lg:gap-y-8 lg:px-[60px] lg:pb-16 lg:pt-20">
          {/* Cột trái phần 1: Eyebrow + H1 + Sub */}
          <div className="min-w-0 lg:col-start-1">
            <div className="mb-4 inline-flex max-w-full items-center gap-2 rounded-ga-pill border border-ga-border bg-ga-card px-3.5 py-1.5 text-ga-eyebrow uppercase text-ga-ink shadow-ga-sm sm:mb-6">
              <YellowSq /><span className="min-w-0 break-words">{t('hero.eyebrow')}</span>
            </div>
            <h1 className="font-ga-display text-ga-m-hero-m sm:text-ga-m-hero-t lg:text-ga-m-hero text-ga-ink">
              {t('hero.titleLead')}{' '}
              <em className="ga-hero-mark italic">
                {t('hero.titleEm')}
              </em>
            </h1>
            <p className="mt-4 max-w-[540px] text-ga-body-lg text-ga-muted sm:mt-6 sm:text-ga-m-lead">
              {t('hero.sub')}
            </p>
          </div>

          {/* Cột phải (trên điện thoại đứng ngay dưới H1+Sub trong màn 1): Ô "Bạn làm nghề gì?" */}
          <div className="relative min-w-0 lg:col-start-2 lg:row-span-2">
            <div aria-hidden className="absolute -right-3 -top-3 hidden h-[78%] w-[86%] rounded-ga-xl bg-ga-yellow sm:block lg:-right-4 lg:-top-4" />
            <div className="relative min-w-0">
              <OccupationExplorer
                startHref={START_HREF}
                onStart={() => trackCta('occupation_explorer')}
                onSelect={trackOccupation}
              />
            </div>
          </div>

          {/* Cột trái phần 2: Nút hành động + App Store + Microcopy + Bullets */}
          <div className="min-w-0 lg:col-start-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
              <GaBtn asChild variant="yellow" size="lg" className="ga-btn-gleam w-full sm:w-auto">
                <Link href={START_HREF} onClick={() => trackCta('hero')}><YellowSq dark />{t('hero.ctaStart')}</Link>
              </GaBtn>
              <AppStoreHeroLink />
            </div>
            <p className="mt-3 text-ga-small text-ga-muted">{t('hero.microcopy')}</p>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2.5 sm:mt-7">
              {heroBullets.map((b) => (
                <span key={b} className="flex items-center gap-1.5 text-ga-small text-ga-muted">
                  <span className="inline-block h-[5px] w-[5px] rounded-ga-pill bg-ga-yellow" />{b}
                </span>
              ))}
            </div>
          </div>

          {/* Dải 4 trụ cột thương hiệu phủ trọn chiều ngang cuối Hero */}
          <div className="min-w-0 pt-2 lg:col-span-2 lg:pt-4">
            <BrandPillars />
          </div>
        </div>
      </section>

      {/* S5 — Báo cáo mẫu Auswertungsbogen (giữ nguyên anh em trực tiếp sau #interview) */}
      <section id="report" className="scroll-mt-[78px] border-t border-ga-border">
        <div className={SECTION}>
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.18fr)] md:gap-14">
            <div className="min-w-0">
              <GaCap className="mb-4">{t('report.cap')}</GaCap>
              <h2 className={`${H2} mb-3`}>{t('report.title')}</h2>
              <p className="text-ga-body-lg text-ga-muted">{t('report.sub')}</p>
            </div>
            <div className="min-w-0 rounded-ga-xl border border-ga-border-strong bg-ga-card p-5 shadow-ga-md sm:p-7">
              <GaCap className="mb-4">{t('report.sampleCap')}</GaCap>
              <div className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-ga-border pb-4">
                <span className="font-ga-display text-ga-stat text-ga-ink">{t('report.overall')}</span>
                <span className="text-ga-body text-ga-muted">{t('report.verdict')}</span>
              </div>
              <div className="mb-5 grid grid-cols-3 gap-3">
                {phases.map((ph) => {
                  const pct = Math.min(100, Math.max(15, Number.parseInt(ph.score, 10) || 68))
                  return (
                    <div key={ph.name} className="rounded-ga-md border border-ga-border bg-ga-bg p-3 text-center">
                      <div className="font-ga-display text-ga-numeral text-ga-ink">{ph.score}</div>
                      <div className="mt-0.5 text-ga-caption text-ga-muted">{ph.name}</div>
                      <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-ga-pill bg-ga-surface-3">
                        <div className="ga-bar-grow h-full rounded-ga-pill bg-ga-yellow" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <SentenceFix
                quoteCap={t('report.quoteCap')}
                quote={t('report.quote')}
                wrong={t('report.quoteWrong')}
                fixCap={t('report.fixCap')}
                fix={t('report.fix')}
                right={t('report.fixRight')}
                why={t('report.fixWhy')}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                {([[t('report.strengthsCap'), strengths], [t('report.gapsCap'), gaps]] as const).map(([cap, list]) => (
                  <div key={cap}>
                    <GaCap className="mb-2">{cap}</GaCap>
                    <ul className="flex flex-col gap-1.5">
                      {list.map((s) => (
                        <li key={s} className="flex items-start gap-2 text-ga-small text-ga-ink">
                          <span className="mt-[7px] inline-block h-[5px] w-[5px] shrink-0 bg-ga-yellow" />{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-ga-border pt-4">
                <GaCap className="mb-2">{t('report.drillsCap')}</GaCap>
                <ul className="flex flex-col gap-1.5">
                  {drills.map((d) => (
                    <li key={d} className="flex items-start gap-2 text-ga-small text-ga-ink">
                      <span className="mt-[7px] inline-block h-[5px] w-[5px] shrink-0 bg-ga-ink" />{d}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bằng chứng xã hội — khung ẩn tới khi có dữ liệu thật */}
      <SocialProof />

      {/* Dàn người phỏng vấn — vuốt ngang 1 hàng trên điện thoại, lưới đầy đủ trên desktop */}
      <CastSection />

      {/* S4 — Hành trình sang Đức */}
      <section id="pathways" className="scroll-mt-[78px] border-y border-ga-border bg-ga-card">
        <div className={SECTION}>
          <GaCap className="mb-4">{t('pathways.cap')}</GaCap>
          <h2 className={`${H2} mb-3`}>{t('pathways.title')}</h2>
          <p className="mb-8 max-w-[620px] text-ga-body-lg text-ga-muted">{t('pathways.sub')}</p>
          <PathwayTabs
            items={pathways}
            colors={PATHWAY_COLORS}
            ariaLabel={t('pathways.cap')}
            labels={{ level: t('pathways.levelLabel'), exam: t('pathways.examLabel'), interview: t('pathways.interviewLabel') }}
          />
        </div>
      </section>

      {/* Ngoài phỏng vấn — lộ trình A1–B1, từ vựng, video trên app */}
      <section id="learning-path" className="scroll-mt-[78px]">
        <div className={SECTION}>
          <GaCap className="mb-4">{t('learn.cap')}</GaCap>
          <h2 className={`${H2} mb-3`}>{t('learn.title')}</h2>
          <p className="mb-9 max-w-[600px] text-ga-body-lg text-ga-muted">{t('learn.sub')}</p>
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-14">
            <div className="min-w-0">
              <ul className="grid gap-4 sm:grid-cols-2">
                {learnItems.map((it, i) => (
                  <li key={it.name} className="flex gap-3 rounded-ga-md border border-ga-border bg-ga-card p-4 shadow-ga-sm">
                    <GaGlyphMark name={LEARN_GLYPHS[i]} size={28} draw="view" className="mt-0.5 block shrink-0 text-ga-ink" />
                    <div>
                      <div className="text-ga-h3 text-ga-ink">{it.name}</div>
                      <p className="mt-1 text-ga-small text-ga-muted">{it.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <AppStoreLearnRow />
            </div>
            <GaShot
              name="roadmap"
              caption={t('learn.shotCap')}
              alt={t('learn.shotAlt')}
              accent="var(--ga-yellow)"
              sizes={SHOT_HALF_SIZES}
            />
          </div>
        </div>
      </section>

      {/* S6 — Thi thử telc Deutsch B1 theo format thật */}
      <section id="exam" className={`${SECTION} scroll-mt-[78px]`}>
        <GaCap className="mb-4">{t('exam.cap')}</GaCap>
        <h2 className={`${H2} mb-3`}>{t('exam.title')}</h2>
        <p className="mb-9 max-w-[600px] text-ga-m-lead text-ga-muted">{t('exam.sub')}</p>
        {showExamClip ? (
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-12">
            <div className="mx-auto w-full max-w-[420px] lg:max-w-none">
              <ExamClip
                caption={t('exam.clipCap')}
                label={t('exam.clipAlt')}
                playLabel={t('exam.clipPlay')}
                pauseLabel={t('exam.clipPause')}
                accent="var(--ga-orange)"
              />
            </div>
            <div className="min-w-0">
              {examGrid}
              {examDisclaimer}
            </div>
          </div>
        ) : (
          <>
            {examGrid}
            {examDisclaimer}
          </>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-ga-lg bg-ga-ink p-5 text-ga-bg shadow-ga-md sm:px-7 sm:py-6">
          <div className="min-w-0 flex-1 basis-[260px]">
            <div className="mb-1.5 text-ga-eyebrow uppercase text-ga-yellow">{t('exam.bannerCap')}</div>
            <div className="font-ga-display text-ga-h2 text-ga-bg">{t('exam.bannerTitle')}</div>
          </div>
          <GaBtn asChild variant="yellow" size="lg" className="ga-btn-gleam w-full sm:w-auto">
            <Link href={START_HREF} onClick={() => trackCta('exam_section')}><YellowSq dark />{t('exam.cta')}</Link>
          </GaBtn>
        </div>
      </section>

      {/* Băng xem nhanh Gói học phí B2C (đọc nguồn đơn nhất từ chiPhiPage.ts) */}
      <PlansPreviewBand
        onStartClick={() => trackCta('plans_preview')}
        ctaStartLabel={t('hero.ctaStart')}
      />

      {/* S7 — Lối sang trung tâm (A) và nhà tuyển dụng (E) */}
      <section id="centers" className="scroll-mt-[78px] border-y border-ga-border bg-ga-card">
        <div className={SECTION}>
          <GaCap className="mb-4">{t('partners.cap')}</GaCap>
          <h2 className={`${H2} mb-8`}>{t('partners.title')}</h2>
          <div className="flex flex-col gap-5 rounded-ga-lg border border-ga-border bg-ga-bg p-5 shadow-ga-sm sm:p-7 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
            <div className="min-w-0 max-w-[640px]">
              <GaCap className="mb-2 text-ga-violet">{t('partners.centers.cap')}</GaCap>
              <div className="text-ga-h2 text-ga-ink">{t('partners.centers.title')}</div>
              <p className="mt-2 text-ga-body text-ga-muted">{t('partners.centers.body')}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <GaBtn asChild variant="ink" size="lg" className="w-full sm:w-auto">
                <Link href={`${centersHref}#dat-lich`}><YellowSq />{t('partners.centers.ctaConsult')}</Link>
              </GaBtn>
              <GaBtn asChild variant="ghost" size="lg" className="w-full sm:w-auto">
                <Link href={`${centersHref}#giao-vien`}>{t('partners.centers.ctaFree')}</Link>
              </GaBtn>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2 rounded-ga-md border border-ga-border bg-ga-bg px-5 py-4 sm:px-7 md:flex-row md:items-center md:justify-between md:gap-8">
            <p className="text-ga-small text-ga-ink">
              <span className="font-semibold text-ga-blue">{t('partners.employers.cap')}</span>
              {' · '}{t('partners.employers.title')}
              <span className="text-ga-muted"> · {t('partners.employers.soon')}</span>
            </p>
            <p className="shrink-0 select-all text-ga-small text-ga-ink">{t('partners.employers.contact')}</p>
          </div>
        </div>
      </section>

      {/* S9 — Câu hỏi thường gặp (đóng mặc định để ngắn gọn trên điện thoại) */}
      <section id="faq" className={`${SECTION} scroll-mt-[78px]`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqLd }} />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-14">
          <div>
            <GaCap className="mb-4">{t('faq.cap')}</GaCap>
            <h2 className={`${H2} mb-4`}>{t('faq.title')}</h2>
            <p className="text-ga-body text-ga-muted">{t('faq.contactLead')}</p>
            <p className="mt-1 select-all text-ga-body font-semibold text-ga-ink">{SUPPORT_EMAIL}</p>
          </div>
          <div className="divide-y divide-ga-border rounded-ga-lg border border-ga-border bg-ga-card px-5 shadow-ga-sm sm:px-6">
            {faqs.map((f) => (
              <details key={f.q} className="group">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 text-ga-h3 text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus">
                  {f.q}
                  <Plus size={18} aria-hidden className="shrink-0 text-ga-muted transition-transform group-open:rotate-45" />
                </summary>
                <p className="max-w-[760px] pb-5 text-ga-body text-ga-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* S10 — Vì sao có myDeutschFlow + CTA vàng kết trang */}
      <FounderBand />
      <section className="bg-ga-yellow">
        <div className="mx-auto grid max-w-[1240px] items-center gap-8 px-5 py-14 sm:px-8 md:py-[72px] lg:px-[60px] min-[1240px]:grid-cols-[1fr_auto] min-[1240px]:gap-[60px]">
          <div>
            <GaCap className="mb-4 text-ga-ink">{t('cta.cap')}</GaCap>
            <h2 className="text-balance font-ga-display text-ga-h1 font-medium leading-[1.12] text-ga-ink lg:text-ga-display">{t('cta.title')}</h2>
          </div>
          <GaBtn asChild variant="ink" size="lg" className="w-full justify-self-start sm:w-auto">
            <Link href={START_HREF} onClick={() => trackCta('footer_cta')}><YellowSq />{t('cta.button')}</Link>
          </GaBtn>
        </div>
      </section>

      </main>

      <LandingFooter />
      <MobileStickyCta mode="b2c" />
    </div>
  )
}
