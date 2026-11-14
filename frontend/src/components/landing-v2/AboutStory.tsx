'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowDown } from 'lucide-react'
import { GaBtn, GaCap } from '@/components/ui-v2'
import type { PersonaId } from '@/lib/personas'
import { GaShot } from './GaShot'
import { PersonaPortrait } from './PersonaPortrait'
import { PublicShell } from './PublicShell'
import { START_HREF, SUPPORT_EMAIL } from './links'
import founderStudio from '../../assets/landing/founder/founder-studio.webp'
import founderSquare from '../../assets/landing/founder/founder-studio-square.webp'

/*
 * Trang "Về chúng tôi" kể thành câu chuyện (làm mới hình ảnh 19/10/2026, đồng bộ giao diện v3.4 14/11/2026),
 * ba thứ tiếng qua catalog `v2.landing.about`: mở đầu có ảnh người làm sản phẩm → Chương 01 Khoảng trống →
 * câu trích → Chương 02 Tự xây (người phỏng vấn + ảnh thật của app) → Chương 03 Từng bước (dòng thời gian) →
 * Chương 04 Mở rộng (người học, trung tâm, nhà tuyển dụng) → điều mình quan tâm → lời ký tên.
 */

const STRIP: PersonaId[] = ['klaus', 'niklas', 'sarah', 'max', 'lukas', 'nina']
const GROUP_BARS = ['bg-ga-yellow', 'bg-ga-navy', 'bg-ga-red']

type Group = { name: string; body: string }
type Value = { title: string; body: string }
type Milestone = { date: string; title: string; body: string }

const YellowDot = () => <span className="inline-block h-2 w-2 shrink-0 rounded-ga-pill bg-ga-yellow" />

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
    <PublicShell current="about" stickyCta="b2c">
      {/* Mở đầu — trên màn rộng, 110px cuối là nền mực để ảnh "đứng" lên chương 01 */}
      <section className="md:bg-[linear-gradient(to_bottom,var(--ga-bg)_0,var(--ga-bg)_calc(100%-110px),var(--ga-ink)_calc(100%-110px))]">
        <div className="mx-auto grid max-w-[1240px] items-end gap-10 px-5 pb-10 pt-10 sm:px-8 md:grid-cols-[minmax(0,1fr)_minmax(0,480px)] md:gap-16 md:pb-0 md:pt-16 lg:px-[60px]">
          <div className="md:pb-[160px]">
            <div className="mb-5 inline-flex items-center gap-2 rounded-ga-pill border border-ga-border bg-ga-card px-3.5 py-1 text-ga-eyebrow uppercase text-ga-muted">
              <YellowDot />
              {t('hero.cap')}
            </div>
            <h1 className="font-ga-display text-ga-m-h1-m font-medium text-ga-ink sm:text-ga-m-h1-t lg:text-ga-m-h1">
              {t('hero.titleLead')}{' '}
              <em className="ga-hero-mark italic text-ga-navy">{t('hero.titleEm')}</em>
            </h1>
            <p className="mt-5 max-w-[520px] text-ga-m-lead text-ga-muted">{t('hero.sub')}</p>
            <a
              href="#ch1"
              className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-ga-pill border border-ga-border bg-ga-card px-4 py-2 text-ga-body font-semibold text-ga-ink shadow-ga-sm transition-colors hover:border-ga-ink"
            >
              {t('hero.readOn')}
              <ArrowDown size={16} aria-hidden />
            </a>
          </div>

          <figure className="relative mx-auto w-full max-w-[420px] md:max-w-none">
            <div className="overflow-hidden rounded-ga-xl border border-ga-border bg-ga-card shadow-ga-lg">
              <Image
                src={founderStudio}
                alt={t('hero.photoAlt')}
                priority
                sizes="(min-width: 768px) 480px, 100vw"
                className="block h-auto w-full"
              />
            </div>
            <figcaption className="absolute bottom-6 left-3 rounded-ga-md border border-ga-ink/15 bg-ga-yellow px-4 py-3 text-ga-small text-ga-ink shadow-ga-md md:-left-6">
              <strong className="block text-ga-body font-semibold">{tl('founder.name')}</strong>
              {tl('founder.role')}
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Chương 01 — Khoảng trống */}
      <section id="ch1" className="scroll-mt-[78px] bg-ga-ink text-ga-bg">
        <div className="mx-auto grid max-w-[1240px] gap-5 px-5 py-14 sm:px-8 md:grid-cols-[180px_minmax(0,1fr)] md:gap-12 md:py-24 lg:px-[60px]">
          <ChapterLabel n="01" name={t('ch1.name')} dark />
          <div className="max-w-[680px]">
            <h2 className="mb-6 font-ga-display text-ga-m-h2-m font-medium text-ga-bg sm:text-ga-m-h2-t lg:text-ga-m-h2">
              {t('ch1.title')}
            </h2>
            {ch1Body.map((p) => (
              <p key={p} className="mb-4 text-ga-m-prose text-ga-faint last:mb-0">
                {p}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* Câu trích */}
      <section className="mx-auto max-w-[840px] px-5 py-14 text-center sm:px-8 md:py-20">
        <div className="rounded-ga-xl border border-ga-border bg-ga-card p-6 shadow-ga-sm sm:p-10">
          <blockquote className="font-ga-display text-ga-m-h2-m italic text-ga-ink sm:text-ga-m-h2-t">
            “{t('quote')}”
          </blockquote>
          <p className="mt-4 text-ga-small font-medium text-ga-muted">{tl('founder.name')}</p>
        </div>
      </section>

      {/* Chương 02 — Tự xây */}
      <section className="pb-14 md:pb-24">
        <div className="mx-auto grid max-w-[1240px] gap-5 px-5 sm:px-8 md:grid-cols-[180px_minmax(0,1fr)] md:gap-12 lg:px-[60px]">
          <ChapterLabel n="02" name={t('ch2.name')} />
          <div className="min-w-0">
            <h2 className="mb-5 max-w-[680px] font-ga-display text-ga-m-h2-m font-medium text-ga-ink sm:text-ga-m-h2-t lg:text-ga-m-h2">
              {t('ch2.title')}
            </h2>
            <p className="mb-8 max-w-[680px] text-ga-m-prose text-ga-muted">{t('ch2.body')}</p>
            <div className="mb-8 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
              {STRIP.map((id) => (
                <div key={id} className="overflow-hidden rounded-ga-lg border border-ga-border bg-ga-card shadow-ga-sm">
                  <PersonaPortrait id={id} />
                </div>
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

      {/* Chương 03 — Từng bước */}
      <section className="border-t border-ga-border">
        <div className="mx-auto grid max-w-[1240px] gap-5 px-5 py-14 sm:px-8 md:grid-cols-[180px_minmax(0,1fr)] md:gap-12 md:py-24 lg:px-[60px]">
          <ChapterLabel n="03" name={t('timeline.name')} />
          <div className="max-w-[740px]">
            <h2 className="mb-8 font-ga-display text-ga-m-h2-m font-medium text-ga-ink sm:text-ga-m-h2-t lg:text-ga-m-h2">
              {t('timeline.title')}
            </h2>
            <ol className="border-l-2 border-ga-ink pl-6 sm:pl-8">
              {timeline.map((m) => (
                <li key={m.date} className="relative pb-6 last:pb-0">
                  <span
                    aria-hidden
                    className="absolute -left-[31px] top-5 h-3.5 w-3.5 rounded-ga-pill border-2 border-ga-ink bg-ga-yellow sm:-left-[39px]"
                  />
                  <div className="rounded-ga-lg border border-ga-border bg-ga-card p-5 shadow-ga-sm">
                    <p className="text-ga-small font-semibold tracking-wide text-ga-navy">{m.date}</p>
                    <p className="mt-1 font-ga-display text-ga-m-h3 font-medium text-ga-ink">{m.title}</p>
                    <p className="mt-1.5 text-ga-body text-ga-muted">{m.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-8 rounded-ga-xl border-l-4 border-ga-yellow bg-ga-card p-5 font-ga-display text-ga-m-h3 italic text-ga-ink shadow-ga-sm sm:p-6">
              {t('timeline.solo')}
            </p>
          </div>
        </div>
      </section>

      {/* Chương 04 — Mở rộng, hướng tới */}
      <section className="border-y border-ga-border bg-ga-card">
        <div className="mx-auto grid max-w-[1240px] gap-5 px-5 py-14 sm:px-8 md:grid-cols-[180px_minmax(0,1fr)] md:gap-12 md:py-24 lg:px-[60px]">
          <ChapterLabel n="04" name={t('ch3.name')} />
          <div>
            <h2 className="mb-5 max-w-[720px] font-ga-display text-ga-m-h2-m font-medium text-ga-ink sm:text-ga-m-h2-t lg:text-ga-m-h2">
              {t('ch3.title')}
            </h2>
            <p className="mb-8 max-w-[680px] text-ga-m-prose text-ga-muted">{t('ch3.body')}</p>
            <ul className="grid gap-4 md:grid-cols-3">
              {groups.map((g, i) => (
                <li key={g.name} className="rounded-ga-xl border border-ga-border bg-ga-bg p-6 shadow-ga-sm">
                  <span className={`mb-4 block h-1.5 w-8 rounded-ga-pill ${GROUP_BARS[i]}`} />
                  <h3 className="mb-2 text-ga-m-h3 font-semibold text-ga-ink">
                    {g.name}
                    {i === 2 && (
                      <span className="ml-2 inline-block rounded-ga-pill bg-ga-ink px-2.5 py-0.5 align-middle text-ga-eyebrow uppercase text-ga-yellow">
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
      <section className="mx-auto max-w-[1240px] px-5 py-14 sm:px-8 md:py-20 lg:px-[60px]">
        <GaCap className="mb-8">{t('values.cap')}</GaCap>
        <ul className="grid gap-5 md:grid-cols-3">
          {values.map((v) => (
            <li key={v.title} className="rounded-ga-xl border border-ga-border bg-ga-card p-6 shadow-ga-sm">
              <YellowDot />
              <h3 className="mb-2.5 mt-3 font-ga-display text-ga-m-h3 font-medium text-ga-ink">{v.title}</h3>
              <p className="text-ga-body text-ga-muted">{v.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Lời ký tên */}
      <section className="bg-ga-yellow pb-16 md:pb-0">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-7 px-5 py-14 sm:px-8 md:gap-10 md:py-20 lg:px-[60px]">
          <Image
            src={founderSquare}
            alt={t('signoff.photoAlt')}
            sizes="120px"
            className="h-28 w-28 shrink-0 rounded-ga-pill border-4 border-ga-ink object-cover shadow-ga-md sm:h-[132px] sm:w-[132px]"
          />
          <div className="min-w-0 flex-[1_1_420px]">
            <p className="font-ga-display text-ga-m-h2-m italic text-ga-ink lg:text-ga-m-h2-t">{t('signoff.line')}</p>
            <p className="mt-3 text-ga-body text-ga-ink">
              <strong className="font-semibold">{tl('founder.name')}</strong> · {t('signoff.contact')}{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold underline underline-offset-2">
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>
          <GaBtn asChild variant="ink" size="lg" className="w-full sm:w-auto">
            <Link href={START_HREF}>
              <YellowDot />
              {t('signoff.cta')}
            </Link>
          </GaBtn>
        </div>
      </section>
    </PublicShell>
  )
}
