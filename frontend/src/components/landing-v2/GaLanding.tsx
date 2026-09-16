'use client'

import * as React from 'react'
import { useTracking } from '@/hooks/useTracking'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { GaLogo, GaBtn, GaCap } from '@/components/ui-v2'
import { LanguageToggle } from '@/components/ui-v2/LanguageToggle'
import { GaShot } from './GaShot'

/**
 * GaLanding — public marketing landing (proto-landing.jsx + proto-landing-sections.jsx).
 * Canonical homepage: rendered at `/` AND at `/v2` (each route wraps it in `.ga-scope`).
 * Full-bleed (no role shell). CTA học viên → /v2/onboarding (phễu value-first, xem START_HREF);
 * CTA B2B + đăng nhập giữ /v2/register · /v2/login · /v2/teacher.
 * Editorial Galerie style: 1px-divided grids, Newsreader display, yellow brand accent.
 *
 * 06/09/2026 (F-I18N-02a, audit UTF-8/i18n): mọi chuỗi hiển thị đọc từ catalog `v2.landing`
 * (messages/v2/landing.{vi,en,de}.json — area `landing`, cấp cho provider gốc trong RootLayout).
 * Phần TIẾNG ĐỨC làm nội dung (tên tính năng/level/ngành bằng tiếng Đức, câu hỏi và từ vựng mẫu,
 * thẻ phỏng vấn demo) là nội dung học nên giữ nguyên trong code cho cả ba locale. Header có
 * LanguageToggle (VI/EN/DE) để khách mới đổi ngôn ngữ ngay tại trang chủ.
 */

const YellowSq = ({ dark = false }: { dark?: boolean }) => (
  <span className={`inline-block h-[7px] w-[7px] shrink-0 ${dark ? 'bg-ga-ink' : 'bg-ga-yellow'}`} />
)

// [labelKey, anchor id] — nhãn đọc từ landing.nav.<labelKey>.
const NAV_LINKS = [
  ['features', 'features'],
  ['learningPath', 'learning-path'],
  ['exam', 'exam'],
  ['teachers', 'teachers'],
] as const

// Footer legal/support links — [labelKey, href]. Route to the standalone pages.
const FOOTER_LINKS = [
  ['about', '/about'],
  ['privacy', '/privacy'],
  ['terms', '/terms'],
  ['support', '/support'],
] as const

// Metadata không dịch (tiếng Đức là nội dung) — ghép theo chỉ số với mảng dịch trong catalog.
const HOW_N = ['01', '02', '03']
const FEATURE_META = [
  { de: 'KI-Sprechtraining', accent: 'var(--ga-yellow)' },
  { de: 'Video-Lektionen', accent: 'var(--ga-green)' },
  { de: 'Wortschatz', accent: 'var(--ga-violet)' },
  { de: 'Lernpfad', accent: 'var(--ga-blue)' },
  { de: 'Prüfung', accent: 'var(--ga-orange)' },
  { de: 'Fortschritt', accent: 'var(--ga-teal)' },
]
const PATH_META = [
  { id: 'A1', de: 'Anfänger', current: false },
  { id: 'A2', de: 'Grundlagen', current: false },
  { id: 'B1', de: 'Beruf', current: true },
  { id: 'B2', de: 'Fortgeschritten', current: false },
  { id: 'C1', de: 'Kompetent', current: false },
]
const EXAM_DE = ['Lesen', 'Hören', 'Schreiben', 'Sprechen']
const AUDIENCE_META = [
  { de: 'Pflegekräfte', color: 'var(--ga-red)' },
  { de: 'IT & Ingenieurwesen', color: 'var(--ga-blue)' },
  { de: 'Gastronomie & Service', color: 'var(--ga-green)' },
]
// Copy gói phải khớp entitlement thật (audit H-01): backend áp hạn mức token AI theo ngày,
// nên không hứa "không giới hạn"; không nêu con số quota cứng vì cấu hình chỉnh được runtime.
/**
 * Đích của mọi CTA "học thử / miễn phí" cho HỌC VIÊN.
 *
 * QA 2026-09-01 (F-13): trang này có 19 link, trong đó 8 CTA đều trỏ thẳng `/v2/register`, KHÔNG
 * một CTA nào trỏ `/v2/onboarding` — trong khi `/v2/onboarding` là trang CÔNG KHAI, đã dịch đủ ba
 * thứ tiếng, có ghép mentor, có "quick win" và đủ event PostHog. Chú thích trong chính trang đó
 * viết: "a GUEST runs the whole funnel here before signing up". Thực tế khách lạ bấm "Học thử miễn
 * phí" rơi thẳng vào form 5 ô kèm số điện thoại bắt buộc, chưa nhận được chút giá trị nào — nên
 * toàn bộ phễu value-first nằm không và dashboard funnel gần như không có dữ liệu.
 *
 * Phễu tự đưa khách sang `/v2/register` ở bước cuối (kèm bản nháp lộ trình), nên đây là THÊM một
 * chặng giá trị trước tường đăng ký chứ không phải thay thế nó. CTA B2B ("Nhận tư vấn…") giữ
 * nguyên: phễu này dành cho học viên, không dành cho trung tâm.
 */
const START_HREF = '/v2/onboarding'
const PLAN_META = [
  { href: START_HREF, highlight: false },
  { href: START_HREF, highlight: true },
  { href: '/v2/register', highlight: false },
]
const INDUSTRY_META = [
  {
    id: 'pflege', de: 'Pflege / Krankenpflege', color: 'var(--ga-red)',
    level: 'B1 – B2', topic: 'Krankenhaus & Pflege', roles: 'Krankenpfleger · Altenpfleger · Pflegehelfer',
    questions: ['„Warum möchten Sie als Pflegekraft in Deutschland arbeiten?"', '„Wie gehen Sie mit schwierigen oder dementen Patienten um?"', '„Beschreiben Sie Ihren typischen Arbeitstag im Krankenhaus."'],
    vocab: ['die Pflegekraft', 'die Untersuchung', 'das Medikament', 'der Patient', 'die Behandlung', 'die Krankenversicherung'],
  },
  {
    id: 'it', de: 'IT / Ingenieur', color: 'var(--ga-blue)',
    level: 'B1 – B2', topic: 'Fachvokabular IT', roles: 'Softwareentwickler · Systemadmin · Ingenieur',
    questions: ['„Können Sie ein Projekt beschreiben, an dem Sie gearbeitet haben?"', '„Welche Programmiersprachen beherrschen Sie am besten?"', '„Wie lösen Sie technische Konflikte im Team?"'],
    vocab: ['die Programmierung', 'die Schnittstelle', 'die Datenbank', 'der Algorithmus', 'die Anforderung', 'die Bereitstellung'],
  },
  {
    id: 'gastro', de: 'Gastronomie / Küche', color: 'var(--ga-green)',
    level: 'A2 – B1', topic: 'Gastronomie', roles: 'Koch · Küchenhilfe · Servicekraft',
    questions: ['„Haben Sie Erfahrung in einer professionellen Küche?"', '„Wie halten Sie die Hygienevorschriften (HACCP) ein?"', '„Wie arbeiten Sie unter Zeitdruck im Service?"'],
    vocab: ['die Küche', 'die Hygiene', 'die Zutat', 'das Gericht', 'die Bestellung', 'der Arbeitsplatz'],
  },
  {
    id: 'bau', de: 'Bau / Handwerk', color: 'var(--ga-orange)',
    level: 'A2 – B1', topic: 'Bau & Sicherheit', roles: 'Maurer · Elektriker · Bauhelfer',
    questions: ['„Welche handwerklichen Fähigkeiten bringen Sie mit?"', '„Kennen Sie die Sicherheitsvorschriften auf der Baustelle?"', '„Können Sie technische Zeichnungen lesen?"'],
    vocab: ['die Baustelle', 'die Sicherheit', 'das Werkzeug', 'der Beton', 'die Zeichnung', 'der Schutzhelm'],
  },
]
const TEACH_ROW_COLORS = ['var(--ga-green)', 'var(--ga-violet)', 'var(--ga-orange)']

type Pair = { title: string; body: string }
type Feature = { name: string; desc: string }
type Level = { name: string; weeks: string; body: string }
type Industry = { label: string; pitch: string }
type ExamPart = { name: string; time: string; body: string }
type TeachValue = { t: string; s: string }
type TeachRow = { who: string; what: string }
type Plan = { name: string; price: string; sub: string; features: string[]; cta: string }
type Stat = { n: string; l: string }

const SECTION = 'mx-auto max-w-[1240px] px-5 py-14 sm:px-8 md:py-[78px] lg:px-[60px]'
// Bề rộng THỰC TẾ của ô ảnh để next/image tải đúng cỡ: khung 1240px trừ 2×60px đệm ở lg. Nhánh
// cuối là 720px chứ không phải bề ngang màn hình — dưới `md` GaShot giữ ảnh ở 720px và cho cuộn
// ngang, khai theo 100vw thì next/image gửi bản ~390px rồi bị kéo giãn thành ảnh nhoè.
const SHOT_FULL_SIZES = '(min-width: 1240px) 1120px, (min-width: 768px) calc(100vw - 64px), 720px'
const SHOT_HALF_SIZES = '(min-width: 1240px) 550px, (min-width: 768px) calc(50vw - 42px), 720px'
const H2 = 'font-ga-display text-[32px] font-medium tracking-[-0.015em] text-ga-ink sm:text-[38px] lg:text-[44px]'

export function GaLanding() {
  const t = useTranslations('v2.landing')
  const raw = <T,>(key: string): T => t.raw(key) as T
  const strong = { b: (chunks: React.ReactNode) => <strong className="text-ga-ink">{chunks}</strong> }

  const stats = raw<Stat[]>('stats')
  const pains = raw<Pair[]>('pains.items')
  const how = raw<Pair[]>('how.items')
  const features = raw<Feature[]>('features.items')
  const levels = raw<Level[]>('path.levels')
  const industries = raw<Industry[]>('industries.items')
  const examParts = raw<ExamPart[]>('exam.parts')
  const audiences = raw<Pair[]>('audiences.items')
  const teachValues = raw<TeachValue[]>('teachers.values')
  const teachRows = raw<TeachRow[]>('teachers.rows')
  const plans = raw<Plan[]>('pricing.plans')
  const heroBullets = raw<string[]>('hero.bullets')

  const [indIdx, setIndIdx] = React.useState(0)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const { trackEvent } = useTracking()
  /**
   * Điểm vào của phễu. Ba chặng sau đã đo được từ trước — `register_success`,
   * `onboarding_completed`, `feature_lesson_completed` — nhưng chặng ĐẦU thì không: cả 7 CTA đều là
   * <Link> trần, nên chỉ còn $autocapture của PostHog, thứ không phân biệt được CTA phễu với 19
   * link khác trên trang và không nói CTA nằm ở đâu. Thiếu chặng này thì không tính được tỉ lệ từ
   * CTA sang đăng ký — chính phép đo mà G5 đặt làm điều kiện cho baseline.
   *
   * `placement` là vị trí trên trang, không phải nhãn nút: nhãn đổi theo ngôn ngữ và theo mỗi lần
   * viết lại copy, còn vị trí thì bền qua các lần thử biến thể.
   */
  const trackCta = React.useCallback(
    (placement: string) => trackEvent('landing_cta_clicked', { placement }),
    [trackEvent],
  )
  const ind = INDUSTRY_META[indIdx]
  const indCopy = industries[indIdx]

  return (
    <div className="min-h-screen overflow-x-clip scroll-smooth bg-ga-bg font-ga-ui text-ga-ink">
      {/* Nav */}
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
            {/* h-11 (44px) ở mọi bề ngang — trước là h-9 (36px) trên máy nhỏ, dưới mức tối thiểu
                44pt của Apple HIG, mà đây là nút chuyển đổi chính nằm ngay cạnh nút menu. */}
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

      {/* QA 13/08: trang thiếu landmark <main> nên VoiceOver/rotor không có "nội dung chính"
          để nhảy tới — người dùng trình đọc màn hình phải lướt qua cả thanh điều hướng mỗi lần. */}
      <main>

      {/* Hero */}
      <section className="mx-auto grid max-w-[1240px] items-center gap-12 px-5 pb-14 pt-10 sm:px-8 sm:pt-14 lg:grid-cols-[1.15fr_1fr] lg:gap-20 lg:px-[60px] lg:pb-[72px] lg:pt-[90px]">
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
            <GaBtn asChild variant="ghost" size="lg" className="w-full sm:w-auto">
              <Link href="/v2/login">{t('hero.ctaLogin')}</Link>
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
        {/* Interview preview card — hội thoại mẫu tiếng Đức giữ nguyên ở mọi locale (nội dung học). */}
        <div className="border border-ga-border bg-ga-card p-5 shadow-[0_8px_48px_rgba(22,21,19,0.07)] sm:p-[28px_30px]">
          <GaCap className="mb-[18px]">{t('hero.previewCap')}</GaCap>
          <div className="mb-[18px] flex items-center gap-3 border-b border-ga-border pb-[18px]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-ga-ink text-[16px] font-bold text-ga-yellow">S</div>
            <div>
              <div className="text-[15px] font-bold">Frau Schmidt</div>
              <div className="text-[12.5px] text-ga-muted">{t('hero.hrRole')}</div>
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] font-bold tracking-[0.04em] text-ga-red">
              <span className="inline-block h-[7px] w-[7px] animate-pulse rounded-full bg-ga-red" />REC
            </span>
          </div>
          <div className="mb-3 bg-ga-bg p-[14px_16px]">
            <GaCap className="mb-[7px] text-ga-subtle">{t('hero.qCap')}</GaCap>
            <div className="font-ga-display text-[16px] italic leading-[1.5]">„Warum haben Sie sich entschieden, als Pflegekraft in Deutschland zu arbeiten?“</div>
          </div>
          <div className="mb-[18px] border border-ga-yellow bg-ga-yellow-soft p-[13px_16px]">
            <GaCap className="mb-[7px] text-ga-gold">{t('hero.answeringCap')}</GaCap>
            <div className="text-[15px] leading-[1.55] text-ga-ink">„Ich möchte meine Fähigkeiten im deutschen Gesundheitssystem erweitern und…“</div>
          </div>
          <div className="grid grid-cols-3">
            {[[t('hero.scorePron'), '82'], [t('hero.scoreGrammar'), '76'], [t('hero.scoreContent'), '88']].map(([l, v], i) => (
              <div key={l} className={`border-t-2 border-ga-border py-3 text-center ${i ? 'border-l border-l-ga-border' : ''}`}>
                <div className="font-ga-display text-[26px] font-medium">{v}</div>
                <div className="mt-1 text-[11.5px] text-ga-muted">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats bar — chỉ nêu năng lực sản phẩm kiểm chứng được, không số liệu xã hội
          không có nguồn (audit 2026-08-28, H-01: 2.400+/92%/4.9 không có provenance). */}
      <div className="grid border-y border-ga-border sm:grid-cols-3">
        {stats.map(({ n, l }, i) => (
          <div key={l} className={`py-6 text-center sm:py-8 ${i ? 'border-t border-ga-border sm:border-l sm:border-t-0' : ''}`}>
            <div className="font-ga-display text-[34px] font-medium sm:text-[42px]">{n}</div>
            <div className="mt-1.5 text-[14px] text-ga-muted sm:mt-[9px]">{l}</div>
          </div>
        ))}
      </div>

      {/* Pain points */}
      <section className={SECTION}>
        <GaCap className="mb-[18px]">{t('pains.cap')}</GaCap>
        <h2 className={`${H2} mb-12 max-w-[700px]`}>{t('pains.title')}</h2>
        <div className="grid border border-ga-border sm:grid-cols-2">
          {pains.map((p, i) => (
            <div key={i} className={`p-6 sm:p-[36px_40px] ${i ? 'border-t border-ga-border' : ''} ${i === 1 ? 'sm:border-t-0' : ''} ${i % 2 ? 'sm:border-l sm:border-l-ga-border' : ''}`}>
              <div className="mb-3.5 font-ga-display text-[20px] font-medium italic leading-[1.35] sm:text-[22px]">„{p.title}“</div>
              <p className="text-[15px] leading-[1.72] text-ga-muted">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-ga-border bg-ga-card">
        <div className={SECTION}>
          <GaCap className="mb-[18px]">{t('how.cap')}</GaCap>
          <h2 className={`${H2} mb-12`}>{t('how.title')}</h2>
          <div className="grid border border-ga-border md:grid-cols-3">
            {how.map((h, i) => (
              <div key={i} className={`p-6 sm:p-[36px_40px] ${i ? 'border-t border-ga-border md:border-l md:border-l-ga-border md:border-t-0' : ''}`}>
                <div className="mb-5 font-ga-display text-[56px] font-normal leading-none text-[#D8D3C8]">{HOW_N[i]}</div>
                <div className="mb-3 text-[18px] font-bold">{h.title}</div>
                <p className="text-[15px] leading-[1.72] text-ga-muted">{h.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className={`${SECTION} scroll-mt-[78px]`}>
        <GaCap className="mb-[18px]">{t('features.cap')}</GaCap>
        <h2 className={`${H2} mb-3 max-w-[760px]`}>{t('features.title')}</h2>
        <p className="mb-11 max-w-[560px] text-[17px] leading-[1.6] text-ga-muted">{t('features.sub')}</p>
        <div className="grid border border-ga-border md:grid-cols-3">
          {features.map((f, i) => (
            <div key={f.name} className={`bg-ga-card p-6 transition-shadow hover:shadow-[var(--ga-shadow-card-hover)] sm:p-[30px_32px] ${i ? 'border-t border-ga-border' : ''} ${i === 1 || i === 2 ? 'md:border-t-0' : ''} ${i % 3 ? 'md:border-l md:border-l-ga-border' : ''}`}>
              <div className="mb-4 flex items-center gap-3">
                <span className="h-[11px] w-[11px] shrink-0" style={{ background: FEATURE_META[i]?.accent }} />
                <span className="text-[18px] font-bold">{f.name}</span>
              </div>
              <div className="mb-3 font-ga-display text-[14px] italic text-ga-subtle">{FEATURE_META[i]?.de}</div>
              <p className="text-[14.5px] leading-[1.7] text-ga-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Learning path */}
      <section id="learning-path" className="scroll-mt-[78px] border-y border-ga-border bg-ga-card">
        <div className={SECTION}>
          <GaCap className="mb-[18px]">{t('path.cap')}</GaCap>
          <h2 className={`${H2} mb-3`}>{t('path.title')}</h2>
          <p className="mb-11 max-w-[600px] text-[17px] leading-[1.6] text-ga-muted">
            {t.rich('path.sub', strong)}
          </p>
          <div className="grid grid-cols-2 border border-ga-border md:grid-cols-5">
            {levels.map((lv, i) => {
              const meta = PATH_META[i]
              return (
                <div key={meta.id} className={`relative border-ga-border p-5 sm:p-[28px_26px] ${i ? (i % 2 ? 'border-l' : 'md:border-l') : ''} ${i >= 2 ? 'border-t md:border-t-0' : ''} ${i === levels.length - 1 ? 'col-span-2 md:col-span-1' : ''} ${meta.current ? 'bg-ga-ink text-ga-bg' : ''}`}>
                  {meta.current && <div className="absolute inset-x-0 top-0 h-[3px] bg-ga-yellow" />}
                  <div className="mb-3.5 flex items-baseline gap-2">
                    <span className={`font-ga-display text-[36px] font-medium leading-none ${meta.current ? 'text-ga-yellow' : 'text-[#D8D3C8]'}`}>{meta.id}</span>
                    {meta.current && <span className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-ga-yellow">{t('path.popular')}</span>}
                  </div>
                  <div className="mb-1 text-[15.5px] font-bold">{lv.name}</div>
                  <div className={`mb-3 font-ga-display text-[12.5px] italic ${meta.current ? 'text-[#A39E94]' : 'text-ga-subtle'}`}>{meta.de} · {lv.weeks}</div>
                  <p className={`text-[13px] leading-[1.6] ${meta.current ? 'text-[#A39E94]' : 'text-ga-muted'}`}>{lv.body}</p>
                </div>
              )
            })}
          </div>
          <div className="mt-5 flex items-center gap-2.5 text-[14px] text-ga-muted">
            <span className="inline-block h-[7px] w-[7px] bg-ga-yellow" />
            <span>{t.rich('path.goal', strong)}</span>
          </div>
          <div className="mt-9 md:mt-11">
            <GaShot
              name="roadmap"
              caption={t('path.shotCap')}
              alt={t('path.shotAlt')}
              accent="var(--ga-yellow)"
              sizes={SHOT_FULL_SIZES}
            />
          </div>
        </div>
      </section>

      {/* Industries — interactive */}
      <section id="industries" className={`${SECTION} scroll-mt-[78px]`}>
        <GaCap className="mb-[18px]">{t('industries.cap')}</GaCap>
        <h2 className={`${H2} mb-3`}>{t('industries.title')}</h2>
        <p className="mb-9 max-w-[580px] text-[17px] leading-[1.6] text-ga-muted">{t('industries.sub')}</p>
        <div className="grid grid-cols-2 border border-ga-border md:grid-cols-4">
          {INDUSTRY_META.map((x, i) => {
            const on = i === indIdx
            return (
              <button
                key={x.id}
                onClick={() => setIndIdx(i)}
                style={{ borderTopColor: on ? x.color : 'transparent' }}
                className={`border-t-[3px] p-[14px_16px] text-left transition-colors sm:p-[18px_20px] ${i ? (i % 2 ? 'border-l border-l-ga-border' : 'md:border-l md:border-l-ga-border') : ''} ${on ? 'bg-ga-ink text-ga-bg' : 'bg-ga-card text-ga-ink'}`}
              >
                <span className="mb-2.5 inline-block h-[9px] w-[9px]" style={{ background: x.color }} />
                <div className="mb-1 text-[15.5px] font-bold">{industries[i]?.label}</div>
                <div className={`font-ga-display text-[12.5px] italic ${on ? 'text-[#A39E94]' : 'text-ga-subtle'}`}>{x.de}</div>
              </button>
            )
          })}
        </div>
        <div className="grid border border-t-0 border-ga-border md:grid-cols-[1fr_1.1fr]">
          <div className="border-ga-border bg-ga-bg p-5 sm:p-[28px_32px] md:border-r">
            <div className="mb-3.5 flex items-center gap-2.5">
              <span className="h-[11px] w-[11px] shrink-0" style={{ background: ind.color }} />
              <span className="text-[18px] font-bold">{indCopy?.label}</span>
            </div>
            <p className="mb-[22px] text-[15px] leading-[1.7] text-ga-muted">{indCopy?.pitch}</p>
            {[[t('industries.roles'), ind.roles], [t('industries.level'), ind.level], [t('industries.topic'), ind.topic]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-t border-ga-border py-[11px]">
                <span className="shrink-0 text-[12.5px] text-ga-muted">{k}</span>
                <span className="text-right text-[13px] font-semibold text-ga-ink">{v}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-ga-border p-5 sm:p-[28px_32px] md:border-t-0">
            <GaCap className="mb-3.5">{t('industries.sampleQ')}</GaCap>
            <div className="mb-6 flex flex-col gap-2.5">
              {ind.questions.map((q, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="shrink-0 font-ga-display text-[15px] font-semibold leading-[1.5]" style={{ color: ind.color }}>{i + 1}</span>
                  <div className="font-ga-display text-[15px] italic leading-[1.5] text-ga-ink">{q}</div>
                </div>
              ))}
            </div>
            <GaCap className="mb-3">{t('industries.vocab')}</GaCap>
            <div className="flex flex-wrap gap-2">
              {ind.vocab.map((w) => (
                <span key={w} className="border border-ga-border bg-ga-card p-[7px_12px] font-ga-display text-[14px] italic text-ga-ink">{w}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-[18px] flex items-center gap-2.5 text-[14px] text-ga-muted">
          <span className="inline-block h-[7px] w-[7px] bg-ga-yellow" />
          <span>{t.rich('industries.more', strong)}</span>
        </div>
      </section>

      {/* Exam */}
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

      {/* Audiences — thay khối testimonial: nói sản phẩm làm gì cho từng nhóm người học */}
      <section className="border-y border-ga-border bg-ga-card">
        <div className={SECTION}>
          <GaCap className="mb-[18px]">{t('audiences.cap')}</GaCap>
          <h2 className={`${H2} mb-12`}>{t('audiences.title')}</h2>
          <div className="grid border border-ga-border md:grid-cols-3">
            {audiences.map((a, i) => (
              <div key={a.title} className={`p-6 sm:p-[36px_40px] ${i ? 'border-t border-ga-border md:border-l md:border-l-ga-border md:border-t-0' : ''}`}>
                <span className="mb-4 inline-block h-[11px] w-[11px]" style={{ background: AUDIENCE_META[i]?.color }} />
                <div className="text-[18px] font-bold">{a.title}</div>
                <div className="mb-4 mt-1 font-ga-display text-[14px] italic text-ga-subtle">{AUDIENCE_META[i]?.de}</div>
                <p className="text-[15px] leading-[1.72] text-ga-muted">{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Teachers */}
      <section id="teachers" className="scroll-mt-[78px] border-y border-ga-border bg-ga-card">
        <div className={SECTION}>
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-[60px]">
          <div>
            <GaCap className="mb-[18px]">{t('teachers.cap')}</GaCap>
            <h2 className="mb-4 font-ga-display text-[30px] font-medium leading-[1.15] tracking-[-0.015em] sm:text-[36px] md:text-[42px] md:leading-[1.12]">{t('teachers.title')}</h2>
            <p className="mb-[30px] max-w-[480px] text-[16.5px] leading-[1.65] text-ga-muted">{t('teachers.sub')}</p>
            <div className="mb-[30px] grid grid-cols-2 border border-ga-border">
              {teachValues.map((v, i) => (
                <div key={v.t} className={`p-4 sm:p-[22px_24px] ${i % 2 ? 'border-l border-l-ga-border' : ''} ${i >= 2 ? 'border-t border-t-ga-border' : ''}`}>
                  <div className="mb-2 flex items-start gap-2.5">
                    <span className="mt-[6px] h-2 w-2 shrink-0 bg-ga-violet" />
                    <span className="text-[15px] font-bold">{v.t}</span>
                  </div>
                  <p className="text-[13px] leading-[1.6] text-ga-muted">{v.s}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <GaBtn asChild variant="ink" size="lg" className="w-full sm:w-auto">
                <Link href="/v2/register"><YellowSq />{t('teachers.ctaConsult')}</Link>
              </GaBtn>
              <GaBtn asChild variant="ghost" size="lg" className="w-full sm:w-auto">
                <Link href="/v2/login">{t('teachers.ctaDemo')}</Link>
              </GaBtn>
            </div>
          </div>
          <div className="border border-ga-border bg-ga-bg p-5 sm:p-[24px_26px]">
            <div className="mb-4 flex items-center justify-between">
              <GaCap>{t('teachers.boardCap')}</GaCap>
              <span className="border border-ga-violet/30 bg-ga-violet-soft p-[4px_10px] text-[10.5px] font-bold text-ga-violet">{t('teachers.pending')}</span>
            </div>
            {teachRows.map((r, i) => (
              <div key={i} className="flex gap-2.5 border-t border-ga-border py-3">
                <span className="mt-1.5 h-2 w-2 shrink-0" style={{ background: TEACH_ROW_COLORS[i] }} />
                <div className="min-w-0 flex-1 text-[13.5px] leading-[1.45] text-ga-ink"><strong>{r.who}</strong> {r.what}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Hai màn giáo viên dùng hằng ngày — ảnh chụp thật, dữ liệu lớp K30 dựng sẵn. Đặt dưới
            lưới hai cột để mỗi ảnh có nửa khung (~550px) và chữ trong ảnh còn đọc được. */}
        <div className="mt-10 grid gap-5 md:mt-[60px] md:grid-cols-2">
          <GaShot
            name="classReport"
            caption={t('teachers.shotReportCap')}
            alt={t('teachers.shotReportAlt')}
            accent="var(--ga-violet)"
            sizes={SHOT_HALF_SIZES}
          />
          <GaShot
            name="grading"
            caption={t('teachers.shotGradingCap')}
            alt={t('teachers.shotGradingAlt')}
            accent="var(--ga-green)"
            sizes={SHOT_HALF_SIZES}
          />
        </div>
        </div>
      </section>

      {/* Pricing */}
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

      {/* CTA footer */}
      <section className="bg-ga-ink text-ga-bg">
        <div className="mx-auto grid max-w-[1240px] items-center gap-8 px-5 py-14 sm:px-8 md:py-[72px] lg:px-[60px] min-[1240px]:grid-cols-[1fr_auto] min-[1240px]:gap-[60px]">
          <div>
            <GaCap className="mb-[18px] text-[#76716A]">{t('cta.cap')}</GaCap>
            <h2 className="text-balance font-ga-display text-[34px] font-medium leading-[1.15] sm:text-[42px] md:leading-[1.1]">{t('cta.title')}</h2>
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
