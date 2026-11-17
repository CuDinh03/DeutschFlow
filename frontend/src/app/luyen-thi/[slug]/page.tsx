import '@/styles/galerie.css'
import type { Metadata } from 'next'
import { ogImage } from '@/lib/ogImage'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronDown, ExternalLink } from 'lucide-react'
import { GERMAN_EXAMS, OFFICIAL_DURATION_NOTE, getExamBySlug, totalDurationMin, type GermanExam } from '@/data/germanExams'
import { absoluteUrl } from '@/lib/siteUrl'
import { GaBtn } from '@/components/ui-v2/GaBtn'
import { GaGlyphMark } from '@/components/ui-v2/GaGlyphMark'
import { TelcSprachbausteineQuiz } from '@/components/marketing/TelcSprachbausteineQuiz'
import { LandingHeader } from '@/components/landing-v2/LandingHeader'
import { LandingFooter } from '@/components/landing-v2/LandingFooter'
import { MobileStickyCta } from '@/components/landing-v2/MobileStickyCta'
import { START_HREF } from '@/components/landing-v2/links'

/**
 * Trang hướng dẫn từng kỳ thi `/luyen-thi/{slug}/` (chỉ tiếng Việt, nâng cấp v3.4 — 14/11/2026):
 * - Riêng `/luyen-thi/telc-b1/` có thêm thẻ trực quan ngưỡng đỗ 60% tách 2 cụm (Viết 135/225 · Nói 45/75)
 *   và mini-quiz tương tác `Sprachbausteine` 3 chỗ trống.
 * - Các trang kỳ thi khác đóng vai trò cẩm nang cấu trúc đề + dẫn sang chấm thử Schreiben.
 */
export function generateStaticParams() {
  return GERMAN_EXAMS.map((e) => ({ slug: e.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const exam = getExamBySlug(params.slug)
  if (!exam) return { title: 'Không tìm thấy kỳ thi · myDeutschFlow' }
  const url = absoluteUrl(`/luyen-thi/${exam.slug}/`)
  return {
    title: exam.metaTitle,
    description: exam.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title: exam.metaTitle,
      description: exam.metaDescription,
      url,
      type: 'article',
      locale: 'vi_VN',
      images: [ogImage('luyen-thi', 'vi', exam.metaTitle)],
    },
    robots: { index: true, follow: true },
  }
}

const YellowSq = ({ dark = false }: { dark?: boolean }) => (
  <span className={`inline-block h-[7px] w-[7px] shrink-0 ${dark ? 'bg-ga-ink' : 'bg-ga-yellow'}`} />
)
const H2 = 'mb-5 font-ga-display text-ga-m-h2-m sm:text-ga-m-h2-t text-ga-ink'

function TelcPassThresholdCard() {
  return (
    <div className="mt-8 rounded-ga-lg border border-ga-border-strong bg-ga-card p-5 shadow-ga-sm sm:p-6">
      <p className="text-ga-eyebrow uppercase text-ga-muted">Quy tắc tính đỗ · Ngưỡng 60% từng cụm</p>
      <h3 className="mt-1 font-ga-display text-ga-h2 text-ga-ink">
        Phải đạt tối thiểu 60% ở cả phần Viết lẫn phần Nói (tổng tối thiểu 180 / 300 điểm)
      </h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-ga-md border border-ga-border bg-ga-bg p-4">
          <div className="flex items-baseline justify-between gap-2">
            <span lang="de" className="text-ga-body font-semibold text-ga-ink">Schriftliche Prüfung</span>
            <span className="font-ga-display text-ga-numeral text-ga-ink">135 / 225</span>
          </div>
          <p className="mt-1 text-ga-caption text-ga-muted">Lesen + Sprachbausteine + Hören + Schreiben (≥ 60%)</p>
          <div aria-hidden className="mt-2.5 h-2 overflow-hidden rounded-ga-pill bg-ga-surface-3">
            <div className="ga-bar-grow h-full w-3/5 rounded-ga-pill bg-ga-yellow" />
          </div>
        </div>
        <div className="rounded-ga-md border border-ga-border bg-ga-bg p-4">
          <div className="flex items-baseline justify-between gap-2">
            <span lang="de" className="text-ga-body font-semibold text-ga-ink">Mündliche Prüfung</span>
            <span className="font-ga-display text-ga-numeral text-ga-ink">45 / 75</span>
          </div>
          <p className="mt-1 text-ga-caption text-ga-muted">Sprechen 3 phần thi theo cặp (≥ 60%)</p>
          <div aria-hidden className="mt-2.5 h-2 overflow-hidden rounded-ga-pill bg-ga-surface-3">
            <div className="ga-bar-grow h-full w-3/5 rounded-ga-pill bg-ga-green" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ExamPage({ params }: { params: { slug: string } }) {
  const exam = getExamBySlug(params.slug)
  if (!exam) notFound()

  const isTelcB1 = exam.slug === 'telc-b1'

  return (
    <div className="ga-scope ga-public min-h-screen overflow-x-clip bg-ga-bg font-ga-ui text-ga-ink">
      <LandingHeader current="exam" showLanguage={false} />
      <main className="mx-auto max-w-[880px] px-5 pb-20 pt-8 sm:px-8 md:pt-14">
        <JsonLd exam={exam} />

        <nav aria-label="Đường dẫn" className="mb-5 text-ga-small text-ga-muted">
          <Link href="/luyen-thi" className="underline decoration-ga-yellow decoration-2 underline-offset-4 hover:text-ga-ink">
            Luyện thi tiếng Đức
          </Link>
          <span aria-hidden> / </span>
          <span>{exam.shortName}</span>
        </nav>

        <div className="mb-4 inline-flex items-center gap-2 rounded-ga-pill border border-ga-border bg-ga-card px-3.5 py-1.5 text-ga-eyebrow uppercase text-ga-ink shadow-ga-sm">
          <YellowSq />{exam.provider} · {exam.level}
        </div>
        <h1 className="font-ga-display text-ga-m-h1-m sm:text-ga-m-h1-t lg:text-ga-m-h1 text-ga-ink">{exam.name}</h1>
        <p className="mt-4 text-ga-m-lead text-ga-muted">{exam.tagline}</p>

        {isTelcB1 ? (
          <>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <GaBtn asChild variant="yellow" size="lg" className="ga-btn-gleam w-full sm:w-auto">
                <Link href={START_HREF}><YellowSq dark />Học thử miễn phí</Link>
              </GaBtn>
              <GaBtn asChild variant="ghost" size="lg" className="w-full sm:w-auto">
                <Link href="/free-grade/">Chấm thử bài viết miễn phí</Link>
              </GaBtn>
            </div>
            <p className="mt-3 text-ga-small text-ga-muted">
              Dùng thử 7 ngày khi đăng ký, gồm thi thử telc B1 đủ 4 kỹ năng. Không cần thanh toán trước.
            </p>
            <p className="mt-5 rounded-ga-md border-l-4 border-ga-yellow bg-ga-card px-4 py-3 text-ga-small text-ga-ink shadow-ga-sm">
              Đề thi thử mô phỏng định dạng telc B1, không liên kết với telc và không thay cho chứng chỉ. Phần chấm Nói đang Beta, điểm chỉ để tham khảo.
            </p>
          </>
        ) : (
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <GaBtn asChild variant="yellow" size="lg" className="ga-btn-gleam w-full sm:w-auto">
              <Link href="/free-grade/"><YellowSq dark />Chấm thử bài viết miễn phí</Link>
            </GaBtn>
            <GaBtn asChild variant="ghost" size="lg" className="w-full sm:w-auto">
              <Link href={START_HREF}>Học thử miễn phí</Link>
            </GaBtn>
          </div>
        )}

        {/* Tổng quan */}
        <section className="mt-10 space-y-4">
          <p className="text-ga-body-lg text-ga-ink">{exam.overview}</p>
          <p className="rounded-ga-md border-l-4 border-ga-yellow bg-ga-card px-4 py-3 text-ga-body text-ga-ink shadow-ga-sm">
            <span className="font-semibold">Dành cho:</span> {exam.whoFor}
          </p>
        </section>

        {/* Cấu trúc đề */}
        <section className="mt-12">
          <h2 className={H2}>Cấu trúc đề thi</h2>
          <div className="overflow-x-auto rounded-ga-lg border border-ga-border bg-ga-card shadow-ga-sm">
            <table className="w-full text-left text-ga-body">
              <thead className="bg-ga-surface-2 text-ga-eyebrow uppercase text-ga-muted">
                <tr>
                  <th className="px-5 py-3.5">Phần thi</th>
                  <th className="hidden px-5 py-3.5 sm:table-cell">Nội dung</th>
                  <th className="whitespace-nowrap px-5 py-3.5">Thời lượng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ga-border">
                {exam.modules.map((m) => (
                  <tr key={m.skill}>
                    <td className="px-5 py-3.5 font-semibold text-ga-ink">{m.name}</td>
                    <td className="hidden px-5 py-3.5 text-ga-muted sm:table-cell">{m.description}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-ga-muted">
                      {m.durationMin ? `~${m.durationMin} phút` : 'Xem trang telc'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-ga-border bg-ga-surface-2">
                  <td className="px-5 py-3 text-ga-small font-semibold text-ga-ink" colSpan={2}>
                    Tổng (tham khảo){exam.modular ? ' · thi và thi lại được từng module' : ''}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-ga-small font-semibold tabular-nums text-ga-ink">
                    {totalDurationMin(exam) ? `~${totalDurationMin(exam)} phút` : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-4 text-ga-body text-ga-ink">
            <span className="font-semibold">Cách tính điểm:</span> {exam.scoring}
          </p>
          <p className="mt-2 text-ga-caption text-ga-muted">
            {totalDurationMin(exam) ? '' : `${OFFICIAL_DURATION_NOTE} `}Thời lượng và cấu trúc chỉ để tham khảo. Hãy kiểm tra lại ở trang chính thức trước khi đăng ký.
          </p>

          {isTelcB1 && (
            <>
              <TelcPassThresholdCard />
              <TelcSprachbausteineQuiz />
            </>
          )}
        </section>

        {/* Checklist sẵn sàng thi */}
        <section className="mt-12">
          <h2 className={H2}>Checklist sẵn sàng thi</h2>
          <p className="mb-5 text-ga-body text-ga-muted">
            Tự đánh giá từng kỹ năng. Mục nào bạn chưa chắc là chỗ cần luyện thêm.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {exam.readiness.map((g) => (
              <div key={g.skill} className="rounded-ga-lg border border-ga-border bg-ga-card p-5 shadow-ga-sm">
                <h3 className="mb-3 text-ga-h3 text-ga-ink">{g.skill}</h3>
                <ul className="space-y-2.5">
                  {g.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-ga-small text-ga-ink">
                      <span aria-hidden className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-ga-pill bg-ga-yellow" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* CTA giữa trang */}
        <div className="mt-12 flex flex-col items-start gap-4 rounded-ga-xl border border-ga-border-strong bg-ga-card p-5 shadow-ga-md sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-3.5">
            <GaGlyphMark name="viet" size={32} className="shrink-0 text-ga-ink" />
            <div>
              <p className="text-ga-h3 text-ga-ink">Thử chấm một bài viết tiếng Đức</p>
              <p className="text-ga-small text-ga-muted">
                Dán bài viết tiếng Đức, AI chấm theo thang 100 và chỉ ra chỗ cần sửa. Miễn phí.
              </p>
            </div>
          </div>
          <GaBtn asChild variant="ink" size="lg" className="w-full shrink-0 sm:w-auto">
            <Link href="/free-grade/">Chấm thử ngay</Link>
          </GaBtn>
        </div>

        {/* Mẹo luyện thi */}
        <section className="mt-12">
          <h2 className={H2}>Mẹo luyện thi</h2>
          <ol className="divide-y divide-ga-border rounded-ga-lg border border-ga-border bg-ga-card px-5 shadow-ga-sm">
            {exam.studyTips.map((tip, i) => (
              <li key={i} className="flex items-start gap-4 py-4 text-ga-body text-ga-ink">
                <span className="w-6 shrink-0 font-ga-display text-ga-numeral tabular-nums text-ga-gold">{i + 1}</span>
                <span>{tip}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Câu hỏi thường gặp */}
        <section className="mt-12">
          <h2 className={H2}>Câu hỏi thường gặp</h2>
          <div className="divide-y divide-ga-border rounded-ga-lg border border-ga-border bg-ga-card px-5 shadow-ga-sm">
            {exam.faqs.map((f, i) => (
              <details key={i} className="group py-4">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-ga-h3 text-ga-ink [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDown size={18} aria-hidden className="mt-0.5 shrink-0 text-ga-muted transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-2 text-ga-body text-ga-muted">{f.a}</p>
              </details>
            ))}
          </div>
          <a
            href={exam.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 text-ga-small font-semibold text-ga-navy underline decoration-ga-yellow decoration-2 underline-offset-4 hover:decoration-ga-ink"
          >
            Xem lịch thi, lệ phí và cách đăng ký ở trang chính thức <ExternalLink size={14} aria-hidden />
          </a>
        </section>

        <RelatedExams current={exam} />
      </main>
      <LandingFooter />
      <MobileStickyCta mode="b2c" />
    </div>
  )
}

function RelatedExams({ current }: { current: GermanExam }) {
  const related = GERMAN_EXAMS.filter((e) => e.slug !== current.slug).slice(0, 3)
  return (
    <section className="mt-12">
      <h2 className={H2}>Các kỳ thi khác</h2>
      <ul className="grid gap-4 sm:grid-cols-3">
        {related.map((e) => (
          <li key={e.slug}>
            <Link
              href={`/luyen-thi/${e.slug}`}
              className="flex h-full flex-col rounded-ga-lg border border-ga-border bg-ga-card p-5 shadow-ga-sm transition-all hover:border-ga-ink hover:shadow-ga-md"
            >
              <span className="text-ga-eyebrow uppercase text-ga-muted">{e.provider} · {e.level}</span>
              <span className="mt-2 font-ga-display text-ga-h2 text-ga-ink">{e.name}</span>
              <span className="mt-1.5 text-ga-small text-ga-muted">{e.tagline}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function JsonLd({ exam }: { exam: GermanExam }) {
  const url = absoluteUrl(`/luyen-thi/${exam.slug}/`)
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: exam.metaTitle,
        description: exam.metaDescription,
        url,
        author: { '@type': 'Organization', name: 'myDeutschFlow', url: absoluteUrl('/') },
        publisher: { '@type': 'Organization', name: 'myDeutschFlow', url: absoluteUrl('/') },
        about: {
          '@type': 'EducationalOccupationalCredential',
          name: exam.name,
        },
        inLanguage: 'vi-VN',
      },
      {
        '@type': 'FAQPage',
        mainEntity: exam.faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Luyện thi tiếng Đức', item: absoluteUrl('/luyen-thi/') },
          { '@type': 'ListItem', position: 2, name: exam.shortName, item: url },
        ],
      },
    ],
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
}
