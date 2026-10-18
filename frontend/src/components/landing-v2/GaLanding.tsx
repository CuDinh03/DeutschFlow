'use client'

import * as React from 'react'
import { useTracking } from '@/hooks/useTracking'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { GaLogo, GaBtn, GaCap } from '@/components/ui-v2'
import { LanguageToggle } from '@/components/ui-v2/LanguageToggle'
import { GaShot } from './GaShot'
import { OccupationExplorer } from './OccupationExplorer'

/**
 * GaLanding — trang chủ công khai cho NGƯỜI HỌC (nhóm B), render ở `/`, `/en/`, `/de/` và `/v2`.
 *
 * 19/10/2026 — đợt 1 định hướng A+B+E (plans/2026-10-18-phuong-an-landing-abe.html, mục 4).
 * Trang chỉ có một việc: cho người học ở bất kỳ nước nào, làm bất kỳ nghề nào, thấy ngay câu hỏi
 * phỏng vấn của đúng nghề mình rồi bắt đầu luyện. Thứ tự khối:
 *   S1 header · S2+S3 hero có ô "Bạn làm nghề gì?" (OccupationExplorer) · S4 hành trình sang Đức ·
 *   S5 báo cáo mẫu · ngoài phỏng vấn (lộ trình A1–B1) · S6 thi Nói theo format · S7 lối sang trung
 *   tâm (A) và nhà tuyển dụng (E) · S8 bảng giá (tạm ẩn) · S9 câu hỏi thường gặp · S10 founder + CTA.
 * Đã bỏ: dải số liệu, bốn ô "vấn đề", ba bước, lưới 6 tính năng, lộ trình 5 cấp, 4 tab ngành cố
 * định, khối "Dành cho ai" theo ba ngành — lý do ở phương án landing, mục "Số phận các khối hiện tại".
 *
 * Mọi câu chữ đọc từ catalog `v2.landing` (messages/v2/landing.{vi,en,de}.json). Mọi lời hứa phải
 * có trong sổ lời hứa (plans/2026-10-18-quyet-dinh-dinh-huong-abe.md, mục 4) — ví dụ khối trung tâm
 * chỉ nói "giáo viên chốt điểm" cho bài VIẾT vì giáo viên chưa đọc được lời học viên trong bài nói.
 */

const YellowSq = ({ dark = false }: { dark?: boolean }) => (
  <span className={`inline-block h-[7px] w-[7px] shrink-0 ${dark ? 'bg-ga-ink' : 'bg-ga-yellow'}`} />
)

// [labelKey, anchor id] — nhãn đọc từ landing.nav.<labelKey>.
const NAV_LINKS = [
  ['interview', 'interview'],
  ['pathways', 'pathways'],
  ['exam', 'exam'],
  ['centers', 'centers'],
] as const

// Footer legal/support links — [labelKey, href]. Route to the standalone pages.
const FOOTER_LINKS = [
  ['about', '/about'],
  ['privacy', '/privacy'],
  ['terms', '/terms'],
  ['support', '/support'],
] as const

const EXAM_DE = ['Lesen', 'Hören', 'Schreiben', 'Sprechen']
const PATHWAY_COLORS = ['var(--ga-yellow)', 'var(--ga-red)', 'var(--ga-blue)', 'var(--ga-violet)', 'var(--ga-green)']
/**
 * Đích của mọi CTA "học thử / miễn phí" cho HỌC VIÊN.
 *
 * QA 2026-09-01 (F-13): CTA học viên phải vào phễu value-first `/v2/onboarding` (trang công khai,
 * ba thứ tiếng, có quick win và event PostHog) chứ không thả khách lạ thẳng vào form đăng ký.
 * Phễu tự đưa khách sang `/v2/register` ở bước cuối. CTA B2B ("Nhận tư vấn…") giữ `/v2/register`:
 * phễu này dành cho học viên, không dành cho trung tâm.
 */
const START_HREF = '/v2/onboarding'
/**
 * Bảng giá TẠM ẨN (owner yêu cầu 17/09/2026; giá theo nước chốt ở đợt 3). Giữ nguyên JSX, catalog
 * `landing.pricing.*` và điểm đo `pricing_plan_N` để bật lại chỉ cần lật cờ này.
 */
const SHOW_PRICING = false
const PLAN_META = [
  { href: START_HREF, highlight: false },
  { href: START_HREF, highlight: true },
  { href: '/v2/register', highlight: false },
]

type ExamPart = { name: string; time: string; body: string }
type Plan = { name: string; price: string; sub: string; features: string[]; cta: string }
type Pathway = { name: string; de: string; who: string; level: string; exam: string; interview: string; fit: string }
type Phase = { name: string; score: string }
type Learn = { name: string; desc: string }
type Faq = { q: string; a: string }

const SECTION = 'mx-auto max-w-[1240px] px-5 py-14 sm:px-8 md:py-[78px] lg:px-[60px]'
// Bề rộng THỰC TẾ của ô ảnh để next/image tải đúng cỡ: khung 1240px trừ 2×60px đệm ở lg. Nhánh
// cuối là 720px chứ không phải bề ngang màn hình — dưới `md` GaShot giữ ảnh ở 720px và cho cuộn
// ngang, khai theo 100vw thì next/image gửi bản ~390px rồi bị kéo giãn thành ảnh nhoè.
const SHOT_FULL_SIZES = '(min-width: 1240px) 1120px, (min-width: 768px) calc(100vw - 64px), 720px'
// Ảnh chấm bài ở khối S7 nằm trong khung tối đa 640px (md:max-w-[640px]).
const SHOT_GRADING_SIZES = '(min-width: 768px) 640px, 720px'
const H2 = 'font-ga-display text-[32px] font-medium tracking-[-0.015em] text-ga-ink sm:text-[38px] lg:text-[44px]'

export function GaLanding() {
  const t = useTranslations('v2.landing')
  const raw = <T,>(key: string): T => t.raw(key) as T

  const examParts = raw<ExamPart[]>('exam.parts')
  const plans = raw<Plan[]>('pricing.plans')
  const heroBullets = raw<string[]>('hero.bullets')
  const pathways = raw<Pathway[]>('pathways.items')
  const phases = raw<Phase[]>('report.phases')
  const strengths = raw<string[]>('report.strengths')
  const gaps = raw<string[]>('report.gaps')
  const drills = raw<string[]>('report.drills')
  const learnItems = raw<Learn[]>('learn.items')
  const centerPoints = raw<string[]>('partners.centers.points')
  const faqs = raw<Faq[]>('faq.items')

  const [menuOpen, setMenuOpen] = React.useState(false)
  const { trackEvent } = useTracking()
  /**
   * Điểm vào của phễu (G5): mọi CTA phễu bắn `landing_cta_clicked` kèm VỊ TRÍ trên trang — nhãn đổi
   * theo ngôn ngữ và theo mỗi lần viết lại copy, còn vị trí thì bền qua các lần thử biến thể.
   */
  const trackCta = React.useCallback(
    (placement: string) => trackEvent('landing_cta_clicked', { placement }),
    [trackEvent],
  )
  // Nghề nào được chọn nhiều → duyệt tay trước (quyết định 6, file quyết định A+B+E).
  const trackOccupation = React.useCallback(
    (positionId: string) => trackEvent('landing_occupation_selected', { position: positionId }),
    [trackEvent],
  )

  // Câu hỏi thường gặp → dữ liệu có cấu trúc FAQPage. Thoát "<" để chuỗi không đóng nhầm thẻ script.
  const faqLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }).replace(/</g, '\\u003c')

  return (
    <div className="min-h-screen overflow-x-clip scroll-smooth bg-ga-bg font-ga-ui text-ga-ink">
      {/* S1 — Nav */}
      <header className="sticky top-0 z-50 border-b border-ga-border bg-ga-bg/90 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between gap-2 px-5 sm:px-8 md:h-[78px] xl:px-[60px]">
          <GaLogo size={26} className="shrink-0 md:hidden" />
          <GaLogo className="hidden shrink-0 md:inline-flex" />
          <nav aria-label={t('nav.mainAria')} className="hidden gap-7 lg:flex xl:gap-9">
            {NAV_LINKS.map(([key, id]) => (
              <a key={id} href={`#${id}`} className="whitespace-nowrap text-[14.5px] font-medium text-ga-muted transition-colors hover:text-ga-ink">
                {t(`nav.${key}`)}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-4 md:gap-5">
            <span className="hidden sm:inline-flex"><LanguageToggle /></span>
            <Link href="/v2/login" className="hidden text-[14.5px] font-semibold text-ga-ink hover:opacity-80 sm:block">
              {t('header.login')}
            </Link>
            {/* h-11 (44px) ở mọi bề ngang — mức tối thiểu 44pt của Apple HIG cho nút chuyển đổi chính. */}
            <GaBtn asChild variant="ink" size="lg" className="h-11 px-3.5 text-[13px] sm:px-6 sm:text-[14.5px]">
              <Link href={START_HREF} onClick={() => trackCta('header')}>
                <YellowSq />
                <span className="sm:hidden">{t('header.tryShort')}</span>
                <span className="hidden sm:inline">{t('header.tryFree')}</span>
              </Link>
            </GaBtn>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-controls="ga-mobile-menu"
              aria-label={menuOpen ? t('header.closeMenu') : t('header.openMenu')}
              className="flex h-11 w-11 shrink-0 items-center justify-center border border-ga-border text-ga-ink lg:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                {menuOpen ? (
                  <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="1.8" />
                ) : (
                  <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.8" />
                )}
              </svg>
            </button>
          </div>
        </div>
        {/* Overlay (absolute) so opening/closing never shifts the page — anchor jumps stay accurate. */}
        {menuOpen && (
          <div id="ga-mobile-menu" className="absolute inset-x-0 top-full border-y border-ga-border bg-ga-bg shadow-[0_16px_40px_rgba(22,21,19,0.1)] lg:hidden">
            <div className="flex flex-col px-5 pb-5 sm:px-8">
              {NAV_LINKS.map(([key, id]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={() => setMenuOpen(false)}
                  className="border-b border-ga-border py-3.5 text-[15px] font-medium text-ga-ink"
                >
                  {t(`nav.${key}`)}
                </a>
              ))}
              <Link
                href="/v2/login"
                onClick={() => setMenuOpen(false)}
                className="border-b border-ga-border py-3.5 text-[15px] font-semibold text-ga-ink sm:hidden"
              >
                {t('header.login')}
              </Link>
              <div className="flex items-center justify-between border-b border-ga-border py-3.5 sm:hidden">
                <LanguageToggle />
              </div>
              <GaBtn asChild variant="ink" size="lg" className="mt-5 w-full">
                <Link href={START_HREF} onClick={() => { trackCta('mobile_menu'); setMenuOpen(false) }}>
                  <YellowSq />{t('header.tryFree')}
                </Link>
              </GaBtn>
            </div>
          </div>
        )}
      </header>

      {/* QA 13/08: landmark <main> để VoiceOver/rotor có "nội dung chính" mà nhảy tới. */}
      <main>

      {/* S2 + S3 — Hero có ô tìm nghề */}
      <section id="interview" className="mx-auto grid max-w-[1240px] scroll-mt-[78px] items-start gap-12 px-5 pb-14 pt-10 sm:px-8 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-[60px] lg:pb-[72px] lg:pt-[90px]">
        <div>
          <div className="mb-[26px] inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ga-muted">
            <YellowSq />{t('hero.eyebrow')}
          </div>
          <h1 className="font-ga-display text-[40px] font-medium leading-[1.1] tracking-[-0.02em] sm:text-[54px] lg:text-[68px] lg:leading-[1.06]">
            {t('hero.titleLead')}{' '}
            <em className="italic [background:linear-gradient(transparent_58%,var(--ga-yellow)_58%,var(--ga-yellow)_90%,transparent_90%)]">
              {t('hero.titleEm')}
            </em>
          </h1>
          <p className="mt-[26px] max-w-[520px] text-[18px] leading-[1.7] text-ga-muted">
            {t('hero.sub')}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:gap-3.5">
            <GaBtn asChild variant="ink" size="lg" className="w-full sm:w-auto">
              <Link href={START_HREF} onClick={() => trackCta('hero')}><YellowSq />{t('hero.ctaStart')}</Link>
            </GaBtn>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 sm:mt-[38px]">
            {heroBullets.map((b) => (
              <span key={b} className="flex items-center gap-1.5 text-[13px] text-ga-muted">
                <span className="inline-block h-[5px] w-[5px] bg-ga-yellow" />{b}
              </span>
            ))}
          </div>
        </div>
        <OccupationExplorer
          startHref={START_HREF}
          onStart={() => trackCta('occupation_explorer')}
          onSelect={trackOccupation}
        />
      </section>

      {/* S4 — Hành trình sang Đức */}
      <section id="pathways" className="scroll-mt-[78px] border-y border-ga-border bg-ga-card">
        <div className={SECTION}>
          <GaCap className="mb-[18px]">{t('pathways.cap')}</GaCap>
          <h2 className={`${H2} mb-3`}>{t('pathways.title')}</h2>
          <p className="mb-11 max-w-[620px] text-ga-body-lg text-ga-muted">{t('pathways.sub')}</p>
          <div className="grid border border-ga-border md:grid-cols-2 xl:grid-cols-5">
            {pathways.map((p, i) => (
              <div key={p.name} className={`flex flex-col gap-3 border-ga-border p-5 sm:p-6 ${i ? 'border-t md:border-t-0' : ''} ${i % 2 ? 'md:border-l' : ''} ${i >= 2 ? 'md:border-t xl:border-t-0' : ''} ${i ? 'xl:border-l' : ''}`}>
                <span className="inline-block h-[9px] w-[9px]" style={{ background: PATHWAY_COLORS[i] }} />
                <div>
                  <div className="text-ga-h3 text-ga-ink">{p.name}</div>
                  {/* Bản tiếng Đức: tên lộ trình đã là thuật ngữ Đức — không lặp lại dòng phụ. */}
                  {p.de !== p.name && <div className="font-ga-display text-ga-small italic text-ga-subtle">{p.de}</div>}
                </div>
                <p className="text-ga-small text-ga-muted">{p.who}</p>
                <dl className="flex flex-col gap-2 border-t border-ga-border pt-3 text-ga-small">
                  {[[t('pathways.levelLabel'), p.level], [t('pathways.examLabel'), p.exam], [t('pathways.interviewLabel'), p.interview]].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-ga-caption text-ga-muted">{k}</dt>
                      <dd className="text-ga-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-auto border-l-2 border-ga-yellow pl-3 text-ga-small text-ga-ink">{p.fit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* S5 — Sau mỗi buổi bạn nhận được gì (báo cáo mẫu, đúng cấu trúc InterviewReportDto) */}
      <section className={SECTION}>
        <div className="grid items-start gap-10 md:grid-cols-[1fr_1.15fr] md:gap-[60px]">
          <div>
            <GaCap className="mb-[18px]">{t('report.cap')}</GaCap>
            <h2 className={`${H2} mb-3`}>{t('report.title')}</h2>
            <p className="text-ga-body-lg text-ga-muted">{t('report.sub')}</p>
          </div>
          <div className="border border-ga-border bg-ga-card p-5 sm:p-7">
            <GaCap className="mb-4 text-ga-subtle">{t('report.sampleCap')}</GaCap>
            <div className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-ga-border pb-4">
              <span className="font-ga-display text-ga-stat text-ga-ink">{t('report.overall')}</span>
              <span className="text-ga-body text-ga-muted">{t('report.verdict')}</span>
            </div>
            <div className="mb-5 grid grid-cols-3">
              {phases.map((ph, i) => (
                <div key={ph.name} className={`py-1 text-center ${i ? 'border-l border-ga-border' : ''}`}>
                  <div className="font-ga-display text-ga-numeral text-ga-ink">{ph.score}</div>
                  <div className="mt-1 text-ga-caption text-ga-muted">{ph.name}</div>
                </div>
              ))}
            </div>
            <div className="mb-4 bg-ga-bg p-4">
              <GaCap className="mb-2 text-ga-subtle">{t('report.quoteCap')}</GaCap>
              <p className="mb-3 font-ga-display text-ga-body-lg italic text-ga-ink">{t('report.quote')}</p>
              <GaCap className="mb-2 text-ga-gold">{t('report.fixCap')}</GaCap>
              <p className="mb-1 font-ga-display text-ga-body-lg italic text-ga-ink">{t('report.fix')}</p>
              <p className="text-ga-small text-ga-muted">{t('report.fixWhy')}</p>
            </div>
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
      </section>

      {/* Ngoài phỏng vấn — lộ trình A1–B1, từ vựng, video trên app (ảnh chụp thật cây lộ trình) */}
      <section id="learning-path" className="scroll-mt-[78px] border-y border-ga-border bg-ga-card">
        <div className={SECTION}>
          <GaCap className="mb-[18px]">{t('learn.cap')}</GaCap>
          <h2 className={`${H2} mb-3`}>{t('learn.title')}</h2>
          <p className="mb-11 max-w-[600px] text-ga-body-lg text-ga-muted">{t('learn.sub')}</p>
          <div className="grid border border-ga-border sm:grid-cols-2 lg:grid-cols-4">
            {learnItems.map((it, i) => (
              <div key={it.name} className={`border-ga-border bg-ga-bg p-5 sm:p-6 ${i ? 'border-t sm:border-t-0' : ''} ${i % 2 ? 'sm:border-l' : ''} ${i >= 2 ? 'sm:border-t lg:border-t-0' : ''} ${i ? 'lg:border-l' : ''}`}>
                <div className="mb-2 text-ga-h3 text-ga-ink">{it.name}</div>
                <p className="text-ga-small text-ga-muted">{it.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-9 md:mt-11">
            <GaShot
              name="roadmap"
              caption={t('learn.shotCap')}
              alt={t('learn.shotAlt')}
              accent="var(--ga-yellow)"
              sizes={SHOT_FULL_SIZES}
            />
          </div>
        </div>
      </section>

      {/* S6 — Thi Nói theo format thật */}
      <section id="exam" className={`${SECTION} scroll-mt-[78px]`}>
        <GaCap className="mb-[18px]">{t('exam.cap')}</GaCap>
        <h2 className={`${H2} mb-3`}>{t('exam.title')}</h2>
        <p className="mb-11 max-w-[600px] text-[17px] leading-[1.6] text-ga-muted">{t('exam.sub')}</p>
        <div className="grid grid-cols-2 border border-ga-border md:grid-cols-4">
          {examParts.map((p, i) => (
            <div key={i} className={`border-ga-border bg-ga-card p-5 sm:p-[28px_26px] ${i ? (i % 2 ? 'border-l' : 'md:border-l') : ''} ${i >= 2 ? 'border-t md:border-t-0' : ''}`}>
              <div className="mb-[3px] font-ga-display text-[24px] font-medium">{EXAM_DE[i]}</div>
              <div className="mb-4 text-[12.5px] text-ga-muted">{p.name} · {p.time}</div>
              <p className="text-[13.5px] leading-[1.65] text-ga-muted">{p.body}</p>
            </div>
          ))}
        </div>
        {/* Sổ lời hứa: thi thử là mô phỏng, phần chấm Nói chưa hiệu chuẩn. */}
        <p className="mt-4 flex items-start gap-2.5 text-ga-small text-ga-muted">
          <span className="mt-[7px] inline-block h-[7px] w-[7px] shrink-0 bg-ga-yellow" />
          <span>
            {t('exam.disclaimer')}{' '}
            <Link href="/luyen-thi" className="text-ga-ink underline">{t('exam.guideLink')}</Link>
          </span>
        </p>
        <div className="mt-9 md:mt-11">
          <GaShot
            name="exam"
            caption={t('exam.shotCap')}
            alt={t('exam.shotAlt')}
            accent="var(--ga-orange)"
            sizes={SHOT_FULL_SIZES}
          />
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-[18px] bg-ga-ink p-5 text-ga-bg sm:p-[22px_28px]">
          <div className="min-w-0 flex-1 basis-[260px]">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ga-yellow">{t('exam.bannerCap')}</div>
            <div className="font-ga-display text-[19px] font-medium leading-[1.35] sm:text-[21px]">{t('exam.bannerTitle')}</div>
          </div>
          <GaBtn asChild variant="yellow" size="lg" className="w-full sm:w-auto">
            <Link href={START_HREF} onClick={() => trackCta('exam_section')}><YellowSq dark />{t('exam.cta')}</Link>
          </GaBtn>
        </div>
      </section>

      {/* S7 — Lối sang trung tâm (A) và nhà tuyển dụng (E) */}
      <section id="centers" className="scroll-mt-[78px] border-y border-ga-border bg-ga-card">
        <div className={SECTION}>
          <GaCap className="mb-[18px]">{t('partners.cap')}</GaCap>
          <h2 className={`${H2} mb-11`}>{t('partners.title')}</h2>
          <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
            <div className="flex flex-col border border-ga-border bg-ga-bg p-5 sm:p-7">
              <GaCap className="mb-3 text-ga-violet">{t('partners.centers.cap')}</GaCap>
              <div className="mb-2 text-ga-h2 text-ga-ink">{t('partners.centers.title')}</div>
              <p className="mb-4 text-ga-body text-ga-muted">{t('partners.centers.body')}</p>
              <ul className="mb-6 grid gap-2 sm:grid-cols-2">
                {centerPoints.map((pt) => (
                  <li key={pt} className="flex items-start gap-2 text-ga-small text-ga-ink">
                    <span className="mt-[6px] h-2 w-2 shrink-0 bg-ga-violet" />{pt}
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <GaBtn asChild variant="ink" size="lg" className="w-full sm:w-auto">
                  <Link href="/v2/register"><YellowSq />{t('partners.centers.ctaConsult')}</Link>
                </GaBtn>
                <GaBtn asChild variant="ghost" size="lg" className="w-full sm:w-auto">
                  <Link href="/giao-vien-mien-phi">{t('partners.centers.ctaFree')}</Link>
                </GaBtn>
              </div>
            </div>
            <div className="flex flex-col border border-ga-border bg-ga-bg p-5 sm:p-7">
              <GaCap className="mb-3 text-ga-blue">{t('partners.employers.cap')}</GaCap>
              <div className="mb-2 text-ga-h2 text-ga-ink">{t('partners.employers.title')}</div>
              <p className="mb-4 text-ga-body text-ga-muted">{t('partners.employers.body')}</p>
              <p className="mb-2 text-ga-eyebrow uppercase text-ga-muted">{t('partners.employers.soon')}</p>
              <p className="mt-auto select-all text-ga-small text-ga-ink">{t('partners.employers.contact')}</p>
            </div>
          </div>
          {/* Ảnh chụp thật màn chấm bài của giáo viên — dữ liệu lớp K30 dựng sẵn. */}
          <div className="mt-10 md:mt-[60px] md:max-w-[640px]">
            <GaShot
              name="grading"
              caption={t('partners.shotGradingCap')}
              alt={t('partners.shotGradingAlt')}
              accent="var(--ga-green)"
              sizes={SHOT_GRADING_SIZES}
            />
          </div>
        </div>
      </section>

      {/* S8 — Pricing — tạm ẩn, xem SHOW_PRICING */}
      {SHOW_PRICING && (
      <section className={SECTION}>
        <GaCap className="mb-[18px]">{t('pricing.cap')}</GaCap>
        <h2 className={`${H2} mb-12`}>{t('pricing.title')}</h2>
        <div className="grid border border-ga-border md:grid-cols-3">
          {plans.map((p, i) => {
            const meta = PLAN_META[i]
            return (
              <div key={i} className={`relative p-7 sm:p-[36px] ${i ? 'border-t border-ga-border md:border-l md:border-l-ga-border md:border-t-0' : ''} ${meta.highlight ? 'bg-ga-ink text-ga-bg' : ''}`}>
                {meta.highlight && <div className="absolute inset-x-0 top-0 h-[3px] bg-ga-yellow" />}
                <GaCap className={`mb-3.5 ${meta.highlight ? 'text-ga-muted' : ''}`}>{p.name}</GaCap>
                <div className="mb-1 font-ga-display text-[40px] font-medium">{p.price}</div>
                {p.sub && <div className="mb-5 text-[13px] text-ga-muted">{p.sub}</div>}
                <div className="mb-7 mt-5 flex flex-col gap-2.5">
                  {p.features.map((f, j) => (
                    <div key={j} className="flex items-center gap-2 text-[14.5px] leading-[1.4]">
                      <span className="inline-block h-[5px] w-[5px] shrink-0 bg-ga-yellow" />{f}
                    </div>
                  ))}
                </div>
                <GaBtn asChild variant={meta.highlight ? 'yellow' : 'ink'} size="md" className="w-full md:w-auto">
                  <Link href={meta.href} onClick={() => trackCta(`pricing_plan_${i + 1}`)}>{p.cta}</Link>
                </GaBtn>
              </div>
            )
          })}
        </div>
      </section>
      )}

      {/* S9 — Câu hỏi thường gặp */}
      <section id="faq" className={`${SECTION} scroll-mt-[78px]`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqLd }} />
        <GaCap className="mb-[18px]">{t('faq.cap')}</GaCap>
        <h2 className={`${H2} mb-9`}>{t('faq.title')}</h2>
        <div className="border-t border-ga-border">
          {faqs.map((f) => (
            <details key={f.q} className="group border-b border-ga-border">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 text-ga-h3 text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus">
                {f.q}
                <span aria-hidden className="shrink-0 text-ga-muted transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="max-w-[760px] pb-5 text-ga-body text-ga-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* S10 — Founder + CTA cuối */}
      <section className="bg-ga-ink text-ga-bg">
        <div className="mx-auto grid max-w-[1240px] items-center gap-8 px-5 py-14 sm:px-8 md:py-[72px] lg:px-[60px] min-[1240px]:grid-cols-[1fr_auto] min-[1240px]:gap-[60px]">
          <div>
            <GaCap className="mb-[18px] text-ga-subtle">{t('cta.cap')}</GaCap>
            <h2 className="text-balance font-ga-display text-[34px] font-medium leading-[1.15] sm:text-[42px] md:leading-[1.1]">{t('cta.title')}</h2>
            <p className="mt-4 max-w-[620px] text-ga-body text-ga-subtle">
              {t('founder.line')}{' '}
              <Link href="/about" className="text-ga-bg underline">{t('founder.link')}</Link>
            </p>
          </div>
          <GaBtn asChild variant="yellow" size="lg" className="w-full justify-self-start sm:w-auto">
            <Link href={START_HREF} onClick={() => trackCta('footer_cta')}><YellowSq dark />{t('cta.button')}</Link>
          </GaBtn>
        </div>
      </section>

      </main>

      {/* Site footer — brand + legal/support links */}
      <footer className="border-t border-ga-border bg-ga-bg">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between md:py-12 lg:px-[60px]">
          <GaLogo />
          <nav aria-label={t('footer.legalAria')} className="flex flex-wrap items-center gap-x-7 gap-y-2">
            {FOOTER_LINKS.map(([key, href]) => (
              <Link
                key={href}
                href={href}
                className="text-[14px] font-medium text-ga-muted transition-colors hover:text-ga-ink"
              >
                {t(`footer.${key}`)}
              </Link>
            ))}
          </nav>
          <p className="text-[12.5px] text-ga-faint">© {new Date().getFullYear()} myDeutschFlow</p>
        </div>
      </footer>
    </div>
  )
}
