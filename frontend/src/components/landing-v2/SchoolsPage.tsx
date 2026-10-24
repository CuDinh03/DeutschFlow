'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { GaBtn, GaCap } from '@/components/ui-v2'
import { LandingFooter } from './LandingFooter'
import { LandingHeader } from './LandingHeader'
import { SchoolDemoForm } from './SchoolDemoForm'

/**
 * Trang cho trung tâm và đơn vị đào tạo (nhóm A) — `/trung-tam/` và `/en/schools/` (đợt 3a, 24/10/2026).
 * Phương án: plans/2026-10-18-phuong-an-landing-abe.html mục 05. Gộp trang cũ `/giao-vien-mien-phi`
 * (nay 301 về `#giao-vien`), bỏ hai lời hứa sai của trang đó: "chấm không giới hạn" và chứng nhận.
 *
 * Thứ tự khối: mở đầu + nút đặt lịch · vấn đề · vòng học năm bước (gắn nhãn Có / Sắp có theo sổ lời
 * hứa) · ba việc xem trong buổi demo · chi phí (KHÔNG hiện số — owner chưa chốt giá) + dữ liệu học viên ·
 * giáo viên tự do (hạn mức bằng số) · ba bước triển khai · form đặt lịch.
 *
 * Mọi câu chữ đọc từ `v2.landing.schools`. Đổi lời hứa thì đối chiếu sổ lời hứa
 * (plans/2026-10-18-quyet-dinh-dinh-huong-abe.md mục 4): bài nói "giáo viên đọc và chốt" để Sắp có cho
 * tới khi đợt 3b lên prod; logo trung tâm chưa được nhắc tới (đợt 4).
 */

type Item = { title: string; body: string }
type Named = { name: string; body: string }
type Step = Named & { state: 'ready' | 'soon' | 'partial'; partial?: string }
type Limit = { name: string; limit: string }

export const DEMO_ANCHOR = 'dat-lich'
export const TEACHER_ANCHOR = 'giao-vien'

const SECTION = 'mx-auto max-w-[1240px] px-5 py-14 sm:px-8 md:py-[72px] lg:px-[60px]'
const H2 = 'font-ga-display text-ga-display-m text-ga-ink md:text-ga-display'
const YellowSq = () => <span className="inline-block h-[7px] w-[7px] shrink-0 bg-ga-yellow" />

function Num({ n }: { n: number }) {
  return (
    <span className="font-ga-display text-ga-h1 text-ga-gold" aria-hidden>
      {String(n).padStart(2, '0')}
    </span>
  )
}

export function SchoolsPage() {
  const t = useTranslations('v2.landing.schools')
  const problems = t.raw('problem.items') as Item[]
  const steps = t.raw('loop.steps') as Step[]
  const demos = t.raw('demos.items') as Named[]
  const dataItems = t.raw('data.items') as string[]
  const limits = t.raw('teacher.limits') as Limit[]
  const setup = t.raw('setup.steps') as Named[]

  const tag = (s: Step) => (s.state === 'ready' ? t('loop.ready') : s.state === 'soon' ? t('loop.soon') : s.partial ?? '')

  return (
    <div className="min-h-screen overflow-x-clip bg-ga-bg font-ga-ui text-ga-ink">
      <LandingHeader current="centers" />
      <main>
        {/* Mở đầu */}
        <section className={SECTION}>
          <GaCap className="mb-[18px] text-ga-violet">{t('hero.cap')}</GaCap>
          <h1 className="max-w-[860px] font-ga-display text-ga-display-m text-ga-ink md:text-ga-display">
            {t('hero.title')}
            <br />
            <em className="text-ga-muted">{t('hero.titleEm')}</em>
          </h1>
          <p className="mt-6 max-w-[640px] text-ga-body-lg text-ga-muted">{t('hero.sub')}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <GaBtn asChild variant="ink" size="lg" className="w-full sm:w-auto">
              <a href={`#${DEMO_ANCHOR}`}><YellowSq />{t('hero.cta')}</a>
            </GaBtn>
            <GaBtn asChild variant="ghost" size="lg" className="w-full sm:w-auto">
              <a href={`#${TEACHER_ANCHOR}`}>{t('hero.ctaTeacher')}</a>
            </GaBtn>
          </div>
        </section>

        {/* Vấn đề */}
        <section className="border-y border-ga-border bg-ga-card">
          <div className={SECTION}>
            <GaCap className="mb-[18px]">{t('problem.cap')}</GaCap>
            <h2 className={`${H2} mb-10`}>{t('problem.title')}</h2>
            <div className="grid gap-5 md:grid-cols-3">
              {problems.map((p) => (
                <div key={p.title} className="border border-ga-border bg-ga-bg p-5 sm:p-6">
                  <h3 className="mb-2 text-ga-h3 text-ga-ink">{p.title}</h3>
                  <p className="text-ga-body text-ga-muted">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Vòng học năm bước */}
        <section className={SECTION}>
          <GaCap className="mb-[18px]">{t('loop.cap')}</GaCap>
          <h2 className={`${H2} mb-10`}>{t('loop.title')}</h2>
          <ol className="grid gap-px border border-ga-border bg-ga-border md:grid-cols-5">
            {steps.map((s, i) => (
              <li key={s.name} className="flex flex-col gap-3 bg-ga-bg p-5">
                <Num n={i + 1} />
                <h3 className="text-ga-h3 text-ga-ink">{s.name}</h3>
                <p className="text-ga-small text-ga-muted">{s.body}</p>
                <span
                  className={`mt-auto self-start border px-2 py-1 text-ga-eyebrow uppercase ${
                    s.state === 'ready' ? 'border-ga-green text-ga-green' : 'border-ga-gold text-ga-ink'
                  }`}
                >
                  {tag(s)}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* Ba việc xem trong buổi demo */}
        <section className="border-y border-ga-border bg-ga-card">
          <div className={SECTION}>
            <GaCap className="mb-[18px]">{t('demos.cap')}</GaCap>
            <h2 className={`${H2} mb-10`}>{t('demos.title')}</h2>
            <div className="grid gap-5 md:grid-cols-3">
              {demos.map((d, i) => (
                <div key={d.name} className="flex flex-col gap-2 border border-ga-border bg-ga-bg p-5 sm:p-6">
                  <Num n={i + 1} />
                  <h3 className="text-ga-h3 text-ga-ink">{d.name}</h3>
                  <p className="text-ga-body text-ga-muted">{d.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Chi phí + dữ liệu học viên */}
        <section className={`${SECTION} grid gap-10 md:grid-cols-2 md:gap-14`}>
          <div>
            <GaCap className="mb-[18px]">{t('pricing.cap')}</GaCap>
            <h2 className="mb-4 font-ga-display text-ga-h1 text-ga-ink">{t('pricing.title')}</h2>
            <p className="text-ga-body-lg text-ga-muted">{t('pricing.body')}</p>
            <GaBtn asChild variant="ghost" size="lg" className="mt-6 w-full sm:w-auto">
              <a href={`#${DEMO_ANCHOR}`}>{t('hero.cta')}</a>
            </GaBtn>
          </div>
          <div>
            <GaCap className="mb-[18px]">{t('data.cap')}</GaCap>
            <h2 className="mb-4 font-ga-display text-ga-h1 text-ga-ink">{t('data.title')}</h2>
            <ul className="flex flex-col gap-3">
              {dataItems.map((d) => (
                <li key={d} className="flex items-start gap-3 text-ga-body text-ga-ink">
                  <span className="mt-[7px] h-2 w-2 shrink-0 bg-ga-violet" />{d}
                </li>
              ))}
            </ul>
            <Link href="/privacy" className="mt-5 inline-block text-ga-body font-semibold text-ga-ink underline underline-offset-4">
              {t('data.privacyLink')}
            </Link>
          </div>
        </section>

        {/* Giáo viên tự do (gộp từ /giao-vien-mien-phi) */}
        <section id={TEACHER_ANCHOR} className="scroll-mt-[78px] border-y border-ga-border bg-ga-card">
          <div className={`${SECTION} grid gap-8 md:grid-cols-[1.2fr_1fr] md:gap-14`}>
            <div>
              <GaCap className="mb-[18px] text-ga-violet">{t('teacher.cap')}</GaCap>
              <h2 className={`${H2} mb-4`}>{t('teacher.title')}</h2>
              <p className="text-ga-body-lg text-ga-muted">{t('teacher.body')}</p>
              <GaBtn asChild variant="ink" size="lg" className="mt-6 w-full sm:w-auto">
                <Link href="/v2/register"><YellowSq />{t('teacher.cta')}</Link>
              </GaBtn>
            </div>
            <div className="self-start border border-ga-border bg-ga-bg">
              {limits.map((l, i) => (
                <div
                  key={l.name}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                  style={{ borderTop: i ? '1px solid var(--ga-border)' : 'none' }}
                >
                  <span className="text-ga-body text-ga-ink">{l.name}</span>
                  <span className="shrink-0 text-ga-small font-semibold text-ga-ink">{l.limit}</span>
                </div>
              ))}
              <p className="border-t border-ga-border px-5 py-4 text-ga-small text-ga-muted">{t('teacher.note')}</p>
            </div>
          </div>
        </section>

        {/* Ba bước triển khai */}
        <section className={SECTION}>
          <GaCap className="mb-[18px]">{t('setup.cap')}</GaCap>
          <h2 className={`${H2} mb-10`}>{t('setup.title')}</h2>
          <ol className="grid gap-5 md:grid-cols-3">
            {setup.map((s, i) => (
              <li key={s.name} className="flex flex-col gap-2 border-t-2 border-ga-ink pt-4">
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
              <GaCap className="mb-[18px] text-ga-violet">{t('form.cap')}</GaCap>
              <h2 className={`${H2} mb-4`}>{t('form.title')}</h2>
              <p className="text-ga-body-lg text-ga-muted">{t('form.sub')}</p>
            </div>
            <SchoolDemoForm />
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  )
}
