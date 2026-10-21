'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { GaBtn, GaCap } from '@/components/ui-v2'
import type { PersonaId } from '@/lib/personas'
import { GaShot } from './GaShot'
import { LandingFooter } from './LandingFooter'
import { LandingHeader } from './LandingHeader'
import { PersonaPortrait } from './PersonaPortrait'
import { START_HREF, SUPPORT_EMAIL } from './links'
import founderStudio from '../../assets/landing/founder/founder-studio.webp'
import founderSquare from '../../assets/landing/founder/founder-studio-square.webp'

/**
 * Trang "Về chúng tôi" kể thành câu chuyện (làm mới hình ảnh 19/10/2026), ba thứ tiếng qua catalog
 * `v2.landing.about`: mở đầu có ảnh người làm sản phẩm → Chương 01 Khoảng trống → câu trích →
 * Chương 02 Tự xây (người phỏng vấn + ảnh thật của app) → Chương 03 Từng bước (dòng thời gian) →
 * Chương 04 Mở rộng (người học, trung tâm, nhà tuyển dụng) → điều mình quan tâm → lời ký tên.
 *
 * Chỉ kể điều có thật. Mốc trong dòng thời gian lấy từ lịch sử git (commit đầu tiên 12/04/2026 = ngày
 * owner quyết định làm, owner xác nhận 20/10/2026); mốc nào không kiểm được ngày thì không đưa lên.
 */

const STRIP: PersonaId[] = ['klaus', 'niklas', 'sarah', 'max', 'lukas', 'nina']
const GROUP_BARS = ['bg-ga-yellow', 'bg-ga-navy', 'bg-ga-red']

type Group = { name: string; body: string }
type Value = { title: string; body: string }
type Milestone = { date: string; title: string; body: string }

const YellowSq = () => <span className="inline-block h-[7px] w-[7px] shrink-0 bg-ga-yellow" />

function ChapterLabel({ n, name, dark = false }: { n: string; name: string; dark?: boolean }) {
  const t = useTranslations('v2.landing.about')
  return (
    <p className="font-ga-display text-ga-body-lg">
      <span className={dark ? 'text-ga-yellow' : 'text-ga-gold'}>{t('chapterLabel', { n })}</span>
      <br />
      <span className={dark ? 'text-ga-subtle' : 'text-ga-muted'}>{name}</span>
    </p>
  )
}

export function AboutStory() {
  const t = useTranslations('v2.landing.about')
  const tl = useTranslations('v2.landing')
  const ch1Body = t.raw('ch1.body') as string[]
  const groups = t.raw('ch3.groups') as Group[]
  const values = t.raw('values.items') as Value[]
  const timeline = t.raw('timeline.items') as Milestone[]

  return (
    <div className="min-h-screen overflow-x-clip bg-ga-bg font-ga-ui text-ga-ink">
      <LandingHeader current="about" />
      <main>
        {/* Mở đầu — trên màn rộng, 110px cuối là nền mực để ảnh "đứng" lên chương 01; cột chữ chừa
            đáy 160px nên không bao giờ chạm phần nền mực. */}
        <section className="md:bg-[linear-gradient(to_bottom,var(--ga-bg)_0,var(--ga-bg)_calc(100%-110px),var(--ga-ink)_calc(100%-110px))]">
          <div className="mx-auto grid max-w-[1240px] items-end gap-10 px-5 pt-12 sm:px-8 md:grid-cols-[minmax(0,1fr)_minmax(0,480px)] md:gap-16 md:pt-[72px] lg:px-[60px]">
            <div className="md:pb-[160px]">
              <div className="mb-[22px] inline-flex items-center gap-2 text-ga-eyebrow uppercase text-ga-muted">
                <YellowSq />{t('hero.cap')}
              </div>
              <h1 className="font-ga-display text-ga-display-m font-medium leading-[1.06] tracking-[-0.02em] sm:text-ga-display">
                {t('hero.titleLead')}{' '}
                <em className="italic text-ga-navy">{t('hero.titleEm')}</em>
              </h1>
              <p className="mt-6 max-w-[520px] text-ga-body-lg text-ga-muted">{t('hero.sub')}</p>
              <a href="#ch1" className="mt-7 inline-flex min-h-11 items-center gap-2 border-b-2 border-ga-yellow text-ga-body font-semibold text-ga-ink">
                {t('hero.readOn')}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <path d="M12 5v14M6 13l6 6 6-6" />
                </svg>
              </a>
            </div>
            <figure className="relative mx-auto w-full max-w-[420px] md:max-w-none">
              <Image
                src={founderStudio}
                alt={t('hero.photoAlt')}
                priority
                sizes="(min-width: 768px) 480px, 100vw"
                className="block h-auto w-full"
              />
              <figcaption className="absolute bottom-8 left-0 bg-ga-yellow px-4 py-3 text-ga-small md:-left-7">
                <strong className="block text-ga-body font-semibold">{tl('founder.name')}</strong>
                {tl('founder.role')}
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Chương 01 — Khoảng trống */}
        <section id="ch1" className="scroll-mt-[78px] bg-ga-ink text-ga-bg">
          <div className="mx-auto grid max-w-[1240px] gap-4 px-5 py-14 sm:px-8 md:grid-cols-[180px_minmax(0,1fr)] md:gap-12 md:py-[104px] lg:px-[60px]">
            <ChapterLabel n="01" name={t('ch1.name')} dark />
            <div className="max-w-[680px]">
              <h2 className="mb-6 font-ga-display text-ga-h1-m font-medium leading-[1.15] lg:text-ga-display">{t('ch1.title')}</h2>
              {ch1Body.map((p) => (
                <p key={p} className="mb-4 text-ga-body-lg text-ga-faint last:mb-0">{p}</p>
              ))}
            </div>
          </div>
        </section>

        {/* Câu trích */}
        <section className="mx-auto max-w-[820px] px-5 py-16 text-center sm:px-8 md:py-[104px]">
          <blockquote className="font-ga-display text-ga-h1-m italic leading-[1.3] text-ga-ink lg:text-ga-display">
            “{t('quote')}”
          </blockquote>
          <p className="mt-5 text-ga-small text-ga-muted">{tl('founder.name')}</p>
        </section>

        {/* Chương 02 — Tự xây */}
        <section className="pb-14 md:pb-[104px]">
          <div className="mx-auto grid max-w-[1240px] gap-4 px-5 sm:px-8 md:grid-cols-[180px_minmax(0,1fr)] md:gap-12 lg:px-[60px]">
            <ChapterLabel n="02" name={t('ch2.name')} />
            <div className="min-w-0">
              <h2 className="mb-6 max-w-[680px] font-ga-display text-ga-h1-m font-medium leading-[1.15] lg:text-ga-display">{t('ch2.title')}</h2>
              <p className="mb-9 max-w-[680px] text-ga-body-lg text-ga-muted">{t('ch2.body')}</p>
              <div className="mb-8 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {STRIP.map((id) => (
                  <PersonaPortrait key={id} id={id} />
                ))}
              </div>
              <GaShot
                name="roadmap"
                caption={tl('learn.shotCap')}
                alt={tl('learn.shotAlt')}
                accent="var(--ga-yellow)"
                sizes="(min-width: 1240px) 900px, (min-width: 768px) calc(100vw - 300px), 720px"
              />
            </div>
          </div>
        </section>

        {/* Chương 03 — Từng bước (mốc lấy từ lịch sử git; owner xác nhận commit đầu tiên là ngày quyết định làm) */}
        <section className="border-t border-ga-border">
          <div className="mx-auto grid max-w-[1240px] gap-4 px-5 py-14 sm:px-8 md:grid-cols-[180px_minmax(0,1fr)] md:gap-12 md:py-[104px] lg:px-[60px]">
            <ChapterLabel n="03" name={t('timeline.name')} />
            <div className="max-w-[720px]">
              <h2 className="mb-10 font-ga-display text-ga-h1-m font-medium leading-[1.15] lg:text-ga-display">{t('timeline.title')}</h2>
              <ol className="border-l-2 border-ga-ink">
                {timeline.map((m) => (
                  <li key={m.date} className="relative pb-9 pl-8 last:pb-0">
                    <span aria-hidden className="absolute -left-[8px] top-1 h-3.5 w-3.5 bg-ga-yellow" />
                    <p className="text-ga-small font-semibold tracking-wide text-ga-ink">{m.date}</p>
                    <p className="mt-1.5 font-ga-display text-ga-h2 text-ga-ink">{m.title}</p>
                    <p className="mt-1.5 text-ga-body text-ga-muted">{m.body}</p>
                  </li>
                ))}
              </ol>
              <p className="mt-12 border-l-4 border-ga-yellow bg-ga-card p-5 font-ga-display text-ga-h3 italic leading-[1.5] text-ga-ink sm:p-6">
                {t('timeline.solo')}
              </p>
            </div>
          </div>
        </section>

        {/* Chương 04 — Mở rộng, hướng tới */}
        <section className="border-y border-ga-border bg-ga-card">
          <div className="mx-auto grid max-w-[1240px] gap-4 px-5 py-14 sm:px-8 md:grid-cols-[180px_minmax(0,1fr)] md:gap-12 md:py-[104px] lg:px-[60px]">
            <ChapterLabel n="04" name={t('ch3.name')} />
            <div>
              <h2 className="mb-6 max-w-[720px] font-ga-display text-ga-h1-m font-medium leading-[1.15] lg:text-ga-display">{t('ch3.title')}</h2>
              <p className="mb-9 max-w-[680px] text-ga-body-lg text-ga-muted">{t('ch3.body')}</p>
              <ul className="grid gap-4 md:grid-cols-3">
                {groups.map((g, i) => (
                  <li key={g.name} className="border border-ga-border bg-ga-bg p-6">
                    <span className={`mb-5 block h-1 w-7 ${GROUP_BARS[i]}`} />
                    <h3 className="mb-2 text-ga-h3 text-ga-ink">
                      {g.name}
                      {i === 2 && (
                        <span className="ml-2 inline-block bg-ga-ink px-1.5 py-0.5 align-middle text-ga-eyebrow uppercase text-ga-yellow">
                          {t('ch3.soon')}
                        </span>
                      )}
                    </h3>
                    <p className="text-ga-body text-ga-muted">{g.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Điều mình quan tâm */}
        <section className="mx-auto max-w-[1240px] px-5 py-14 sm:px-8 md:py-[96px] lg:px-[60px]">
          <GaCap className="mb-9">{t('values.cap')}</GaCap>
          <ul className="grid gap-10 md:grid-cols-3">
            {values.map((v) => (
              <li key={v.title}>
                <YellowSq />
                <h3 className="mb-3 mt-4 font-ga-display text-ga-h2 font-medium text-ga-ink">{v.title}</h3>
                <p className="text-ga-body text-ga-muted">{v.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Lời ký tên */}
        <section className="bg-ga-yellow">
          <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-8 px-5 py-14 sm:px-8 md:gap-10 md:py-[88px] lg:px-[60px]">
            <Image
              src={founderSquare}
              alt={t('signoff.photoAlt')}
              sizes="132px"
              className="h-[132px] w-[132px] shrink-0 rounded-full border-4 border-ga-ink object-cover"
            />
            <div className="min-w-0 flex-[1_1_420px]">
              <p className="font-ga-display text-ga-h2 italic leading-[1.3] text-ga-ink lg:text-ga-h1-m">{t('signoff.line')}</p>
              <p className="mt-4 text-ga-body text-ga-ink">
                <strong className="font-semibold">{tl('founder.name')}</strong> · {t('signoff.contact')}{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold underline underline-offset-2">{SUPPORT_EMAIL}</a>
              </p>
            </div>
            <GaBtn asChild variant="ink" size="lg" className="w-full sm:w-auto">
              <Link href={START_HREF}><YellowSq />{t('signoff.cta')}</Link>
            </GaBtn>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  )
}
