'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { GaBtn, GaCap } from '@/components/ui-v2'
import { GaShot } from './GaShot'
import { LandingFooter } from './LandingFooter'
import { LandingHeader } from './LandingHeader'
import { MobileStickyCta } from './MobileStickyCta'
import { SchoolDemoForm } from './SchoolDemoForm'

/**
 * Trang cho trung tâm và đơn vị đào tạo (nhóm A) — `/trung-tam/` và `/en/schools/` (nâng cấp v3.4 — 14/11/2026).
 *
 * Bổ sung 2 ảnh chụp giao diện thực tế của giáo viên/trung tâm (`grading` & `classReport` theo đúng locale),
 * bọc `.ga-scope.ga-public` + `MobileStickyCta mode="b2b"` (nhảy thẳng xuống `#dat-lich`, không đẩy vào phễu học viên),
 * giữ nguyên quy tắc ẩn mọi con số VNĐ (báo giá trong buổi demo + 2 tuần chạy thử miễn phí).
 */

type Item = { title: string; body: string }
type Named = { name: string; body: string }
type Step = Named & { state: 'ready' | 'soon' | 'partial'; partial?: string }
type Limit = { name: string; limit: string }

export const DEMO_ANCHOR = 'dat-lich'
export const TEACHER_ANCHOR = 'giao-vien'

const SECTION = 'mx-auto max-w-[1240px] px-5 py-12 sm:px-8 md:py-[72px] lg:px-[60px]'
const SHOT_HALF_SIZES = '(min-width: 1240px) 540px, (min-width: 1024px) 50vw, (min-width: 768px) calc(100vw - 64px), 720px'
const H2 = 'font-ga-display text-ga-m-h2-m sm:text-ga-m-h2-t lg:text-ga-m-h2 text-ga-ink'
const YellowSq = ({ dark = false }: { dark?: boolean }) => (
  <span className={`inline-block h-[7px] w-[7px] shrink-0 ${dark ? 'bg-ga-ink' : 'bg-ga-yellow'}`} />
)

function Num({ n }: { n: number }) {
  return (
    <span className="font-ga-display text-ga-h1 text-ga-gold" aria-hidden>
      {String(n).padStart(2, '0')}
    </span>
  )
}

export function SchoolsPage() {
  const t = useTranslations('v2.landing.schools')
  const tp = useTranslations('v2.landing.partners')
  const problems = t.raw('problem.items') as Item[]
  const steps = t.raw('loop.steps') as Step[]
  const demos = t.raw('demos.items') as Named[]
  const dataItems = t.raw('data.items') as string[]
  const limits = t.raw('teacher.limits') as Limit[]
  const setup = t.raw('setup.steps') as Named[]

  const tag = (s: Step) => (s.state === 'ready' ? t('loop.ready') : s.state === 'soon' ? t('loop.soon') : s.partial ?? '')

  return (
    <div className="ga-scope ga-public min-h-screen overflow-x-clip bg-ga-bg font-ga-ui text-ga-ink">
      <LandingHeader current="centers" />
      <main>
        {/* Mở đầu */}
        <section className={SECTION}>
          <div className="mb-4 inline-flex items-center gap-2 rounded-ga-pill border border-ga-border bg-ga-card px-3.5 py-1.5 text-ga-eyebrow uppercase text-ga-ink shadow-ga-sm">
            <YellowSq />{t('hero.cap')}
          </div>
          <h1 className="max-w-[860px] font-ga-display text-ga-m-h1-m sm:text-ga-m-h1-t lg:text-ga-m-h1 text-ga-ink">
            {t('hero.title')}{' '}
            <em className="ga-hero-mark italic text-ga-ink">{t('hero.titleEm')}</em>
          </h1>
          <p className="mt-5 max-w-[640px] text-ga-m-lead text-ga-muted">{t('hero.sub')}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <GaBtn asChild variant="yellow" size="lg" className="ga-btn-gleam w-full sm:w-auto">
              <a href={`#${DEMO_ANCHOR}`}><YellowSq dark />{t('hero.cta')}</a>
            </GaBtn>
            <GaBtn asChild variant="ghost" size="lg" className="w-full sm:w-auto">
              <a href={`#${TEACHER_ANCHOR}`}>{t('hero.ctaTeacher')}</a>
            </GaBtn>
          </div>
        </section>

        {/* Vấn đề */}
        <section className="border-y border-ga-border bg-ga-card">
          <div className={SECTION}>
            <GaCap className="mb-4">{t('problem.cap')}</GaCap>
            <h2 className={`${H2} mb-8`}>{t('problem.title')}</h2>
            <div className="grid gap-5 md:grid-cols-3">
              {problems.map((p) => (
                <div key={p.title} className="rounded-ga-lg border border-ga-border bg-ga-bg p-5 shadow-ga-sm sm:p-6">
                  <h3 className="mb-2 text-ga-h3 text-ga-ink">{p.title}</h3>
                  <p className="text-ga-body text-ga-muted">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Vòng học năm bước */}
        <section className={SECTION}>
          <GaCap className="mb-4">{t('loop.cap')}</GaCap>
          <h2 className={`${H2} mb-8`}>{t('loop.title')}</h2>
          <ol className="grid gap-4 md:grid-cols-5">
            {steps.map((s, i) => (
              <li key={s.name} className="flex flex-col gap-3 rounded-ga-lg border border-ga-border bg-ga-card p-5 shadow-ga-sm">
                <Num n={i + 1} />
                <h3 className="text-ga-h3 text-ga-ink">{s.name}</h3>
                <p className="text-ga-small text-ga-muted">{s.body}</p>
                <span
                  className={`mt-auto self-start rounded-ga-pill border px-2.5 py-0.5 text-ga-eyebrow uppercase ${
                    s.state === 'ready' ? 'border-ga-green bg-ga-green-soft text-ga-green' : 'border-ga-gold bg-ga-yellow-soft text-ga-ink'
                  }`}
                >
                  {tag(s)}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* 2 ảnh chụp giao diện thực tế của giáo viên & trung tâm (grading + classReport) */}
        <section className="border-t border-ga-border bg-ga-surface-2">
          <div className={SECTION}>
            <GaCap className="mb-4">{t('visual.cap')}</GaCap>
            <h2 className={`${H2} mb-3`}>{t('visual.title')}</h2>
            <p className="mb-8 max-w-[680px] text-ga-body-lg text-ga-muted">{t('visual.sub')}</p>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
              <GaShot
                name="grading"
                caption={tp('shotGradingCap')}
                alt={tp('shotGradingAlt')}
                accent="var(--ga-violet)"
                sizes={SHOT_HALF_SIZES}
              />
              <GaShot
                name="classReport"
                caption={t('visual.classReportCap')}
                alt={t('visual.classReportAlt')}
                accent="var(--ga-yellow)"
                sizes={SHOT_HALF_SIZES}
              />
            </div>
          </div>
        </section>

        {/* Ba việc xem trong buổi demo */}
        <section className="border-y border-ga-border bg-ga-card">
          <div className={SECTION}>
            <GaCap className="mb-4">{t('demos.cap')}</GaCap>
            <h2 className={`${H2} mb-8`}>{t('demos.title')}</h2>
            <div className="grid gap-5 md:grid-cols-3">
              {demos.map((d, i) => (
                <div key={d.name} className="flex flex-col gap-2 rounded-ga-lg border border-ga-border bg-ga-bg p-5 shadow-ga-sm sm:p-6">
                  <Num n={i + 1} />
                  <h3 className="text-ga-h3 text-ga-ink">{d.name}</h3>
                  <p className="text-ga-body text-ga-muted">{d.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Chi phí + dữ liệu học viên */}
        <section className={`${SECTION} grid gap-8 md:grid-cols-2 md:gap-12`}>
          <div className="rounded-ga-lg border border-ga-border bg-ga-card p-6 shadow-ga-sm sm:p-7">
            <GaCap className="mb-3">{t('pricing.cap')}</GaCap>
            <h2 className="mb-3 font-ga-display text-ga-h1 text-ga-ink">{t('pricing.title')}</h2>
            <p className="text-ga-body-lg text-ga-muted">{t('pricing.body')}</p>
            <GaBtn asChild variant="ghost" size="lg" className="mt-6 w-full sm:w-auto">
              <a href={`#${DEMO_ANCHOR}`}>{t('hero.cta')}</a>
            </GaBtn>
          </div>
          <div className="rounded-ga-lg border border-ga-border bg-ga-card p-6 shadow-ga-sm sm:p-7">
            <GaCap className="mb-3">{t('data.cap')}</GaCap>
            <h2 className="mb-3 font-ga-display text-ga-h1 text-ga-ink">{t('data.title')}</h2>
            <ul className="flex flex-col gap-3">
              {dataItems.map((d) => (
                <li key={d} className="flex items-start gap-3 text-ga-body text-ga-ink">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-ga-pill bg-ga-violet" />{d}
                </li>
              ))}
            </ul>
            <Link href="/privacy" className="mt-5 inline-block text-ga-body font-semibold text-ga-navy underline decoration-ga-yellow decoration-2 underline-offset-4">
              {t('data.privacyLink')}
            </Link>
          </div>
        </section>

        {/* Giáo viên tự do */}
        <section id={TEACHER_ANCHOR} className="scroll-mt-[78px] border-y border-ga-border bg-ga-card">
          <div className={`${SECTION} grid gap-8 md:grid-cols-[1.2fr_1fr] md:gap-14`}>
            <div>
              <GaCap className="mb-4">{t('teacher.cap')}</GaCap>
              <h2 className={`${H2} mb-4`}>{t('teacher.title')}</h2>
              <p className="text-ga-body-lg text-ga-muted">{t('teacher.body')}</p>
              <GaBtn asChild variant="ink" size="lg" className="mt-6 w-full sm:w-auto">
                <Link href="/v2/register"><YellowSq />{t('teacher.cta')}</Link>
              </GaBtn>
            </div>
            <div className="self-start overflow-hidden rounded-ga-lg border border-ga-border bg-ga-bg shadow-ga-sm">
              {limits.map((l, i) => (
                <div
                  key={l.name}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                  style={{ borderTop: i ? '1px solid var(--ga-border)' : 'none' }}
                >
                  <span className="text-ga-body text-ga-ink">{l.name}</span>
                  <span className="shrink-0 rounded-ga-pill bg-ga-yellow-soft px-3 py-1 text-ga-caption font-semibold text-ga-ink">{l.limit}</span>
                </div>
              ))}
              <p className="border-t border-ga-border px-5 py-4 text-ga-small text-ga-muted">{t('teacher.note')}</p>
            </div>
          </div>
        </section>

        {/* Ba bước triển khai */}
        <section className={SECTION}>
          <GaCap className="mb-4">{t('setup.cap')}</GaCap>
          <h2 className={`${H2} mb-8`}>{t('setup.title')}</h2>
          <ol className="grid gap-5 md:grid-cols-3">
            {setup.map((s, i) => (
              <li key={s.name} className="flex flex-col gap-2 rounded-ga-lg border border-ga-border bg-ga-card p-5 shadow-ga-sm sm:p-6">
                <Num n={i + 1} />
                <h3 className="text-ga-h3 text-ga-ink">{s.name}</h3>
                <p className="text-ga-body text-ga-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Form đặt lịch demo */}
        <section id={DEMO_ANCHOR} className="scroll-mt-[78px] border-t border-ga-border bg-ga-card">
          <div className={`${SECTION} grid gap-8 md:grid-cols-[1fr_1.4fr] md:gap-14`}>
            <div>
              <GaCap className="mb-4">{t('form.cap')}</GaCap>
              <h2 className={`${H2} mb-4`}>{t('form.title')}</h2>
              <p className="text-ga-body-lg text-ga-muted">{t('form.sub')}</p>
            </div>
            <SchoolDemoForm />
          </div>
        </section>
      </main>
      <LandingFooter />
      <MobileStickyCta mode="b2b" b2bHref={`#${DEMO_ANCHOR}`} />
    </div>
  )
}
