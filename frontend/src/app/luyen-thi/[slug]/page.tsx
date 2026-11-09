import '@/styles/galerie.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronDown, ExternalLink, PenLine, Sparkles, Square } from 'lucide-react'
import { GERMAN_EXAMS, getExamBySlug, totalDurationMin, type GermanExam } from '@/data/germanExams'
import { absoluteUrl } from '@/lib/siteUrl'
import { GaBtn } from '@/components/ui-v2/GaBtn'
import { GaGlyph } from '@/components/ui-v2/GaGlyph'
import { LandingHeader } from '@/components/landing-v2/LandingHeader'
import { LandingFooter } from '@/components/landing-v2/LandingFooter'

/**
 * Trang hướng dẫn từng kỳ thi `/luyen-thi/{slug}/` (chỉ tiếng Việt). Icon đợt B (09/11/2026): chuyển sang
 * Galerie như trang tổng `/luyen-thi` và Cẩm nang — header/footer công khai, token `ga-*`, bỏ icon trang trí
 * khổng lồ và icon đầu mục. Nội dung, metadata và JSON-LD giữ nguyên.
 */
export function generateStaticParams() {
  return GERMAN_EXAMS.map((e) => ({ slug: e.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const exam = getExamBySlug(params.slug)
  if (!exam) return { title: 'Không tìm thấy kỳ thi | DeutschFlow' }
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
    },
    robots: { index: true, follow: true },
  }
}

const YellowSq = () => <span className="inline-block h-[7px] w-[7px] shrink-0 bg-ga-yellow" />
const H2 = 'mb-5 font-ga-display text-ga-h2 font-medium text-ga-ink sm:text-ga-h1'

export default function ExamPage({ params }: { params: { slug: string } }) {
  const exam = getExamBySlug(params.slug)
  if (!exam) notFound()

  return (
    <div className="ga-scope min-h-screen overflow-x-clip bg-ga-bg font-ga-ui text-ga-ink">
      <LandingHeader current="exam" showLanguage={false} />
      <main className="mx-auto max-w-[860px] px-5 pb-16 pt-10 sm:px-8 md:pt-14">
        <JsonLd exam={exam} />

        <nav aria-label="Đường dẫn" className="mb-6 text-ga-small text-ga-muted">
          <Link href="/luyen-thi" className="underline underline-offset-4 hover:text-ga-ink">Luyện thi tiếng Đức</Link>
          <span aria-hidden> / </span>
          <span>{exam.shortName}</span>
        </nav>

        <div className="mb-[18px] inline-flex items-center gap-2 text-ga-eyebrow uppercase text-ga-muted">
          <YellowSq />{exam.provider} · {exam.level}
        </div>
        <h1 className="font-ga-display text-ga-h1-m font-medium leading-[1.1] sm:text-ga-h1">{exam.name}</h1>
        <p className="mt-5 text-ga-body-lg text-ga-muted">{exam.tagline}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <GaBtn asChild variant="ink" size="lg" className="w-full sm:w-auto">
            <Link href="/free-grade"><Sparkles size={16} aria-hidden /> Chấm thử bài viết miễn phí</Link>
          </GaBtn>
          <GaBtn asChild variant="ghost" size="lg" className="w-full sm:w-auto">
            <Link href="/v2/register">Luyện thi với DeutschFlow</Link>
          </GaBtn>
        </div>

        {/* Tổng quan */}
        <section className="mt-12 space-y-4">
          <p className="text-ga-body-lg text-ga-ink">{exam.overview}</p>
          <p className="border-l-2 border-ga-yellow pl-4 text-ga-body text-ga-ink">
            <span className="font-semibold">Dành cho:</span> {exam.whoFor}
          </p>
        </section>

        {/* Cấu trúc đề */}
        <section className="mt-14">
          <h2 className={H2}>Cấu trúc đề thi</h2>
          <div className="overflow-x-auto border border-ga-border bg-ga-card">
            <table className="w-full text-left text-ga-body">
              <thead className="bg-ga-surface text-ga-eyebrow uppercase text-ga-muted">
                <tr>
                  <th className="px-5 py-3">Phần thi</th>
                  <th className="hidden px-5 py-3 sm:table-cell">Nội dung</th>
                  <th className="whitespace-nowrap px-5 py-3">Thời lượng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ga-border">
                {exam.modules.map((m) => (
                  <tr key={m.skill}>
                    <td className="px-5 py-3 font-semibold text-ga-ink">{m.name}</td>
                    <td className="hidden px-5 py-3 text-ga-muted sm:table-cell">{m.description}</td>
                    <td className="whitespace-nowrap px-5 py-3 tabular-nums text-ga-muted">~{m.durationMin} phút</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-ga-border bg-ga-surface">
                  <td className="px-5 py-2.5 text-ga-small font-semibold text-ga-ink" colSpan={2}>
                    Tổng (tham khảo){exam.modular ? ' · thi/thi lại từng phần' : ''}
                  </td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-ga-small font-semibold tabular-nums text-ga-ink">
                    ~{totalDurationMin(exam)} phút
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-4 text-ga-body text-ga-ink"><span className="font-semibold">Cách tính điểm:</span> {exam.scoring}</p>
          <p className="mt-2 text-ga-caption text-ga-muted">
            Thời lượng & cấu trúc mang tính tham khảo — xác nhận tại nguồn chính thức trước khi đăng ký.
          </p>
        </section>

        {/* Checklist sẵn sàng thi */}
        <section className="mt-14">
          <h2 className={H2}>Checklist sẵn sàng thi</h2>
          <p className="mb-5 text-ga-body text-ga-muted">
            Tự đánh giá theo từng kỹ năng — nếu còn mục chưa chắc, đó là chỗ cần luyện thêm.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {exam.readiness.map((g) => (
              <div key={g.skill} className="border border-ga-border bg-ga-card p-5">
                <h3 className="mb-3 text-ga-h3 text-ga-ink">{g.skill}</h3>
                <ul className="space-y-2.5">
                  {g.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-ga-small text-ga-ink">
                      <Square size={15} aria-hidden className="mt-[3px] shrink-0 text-ga-muted" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* CTA giữa trang */}
        <div className="mt-14 flex flex-col items-start gap-4 border border-ga-border bg-ga-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-3">
            <GaGlyph icon={PenLine} />
            <div>
              <p className="text-ga-h3 text-ga-ink">Bài viết {exam.level} của bạn được mấy điểm?</p>
              <p className="text-ga-small text-ga-muted">Dán bài Schreiben — AI chấm điểm + nhận xét trong ~15 giây, miễn phí.</p>
            </div>
          </div>
          <GaBtn asChild variant="ink" size="lg" className="w-full shrink-0 sm:w-auto">
            <Link href="/free-grade"><Sparkles size={16} aria-hidden /> Chấm thử ngay</Link>
          </GaBtn>
        </div>

        {/* Mẹo luyện thi */}
        <section className="mt-14">
          <h2 className={H2}>Mẹo luyện thi</h2>
          <ol className="border-t border-ga-border">
            {exam.studyTips.map((tip, i) => (
              <li key={i} className="flex items-start gap-4 border-b border-ga-border py-4 text-ga-body text-ga-ink">
                <span className="w-6 shrink-0 font-ga-display text-ga-numeral tabular-nums text-ga-muted">{i + 1}</span>
                <span>{tip}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Câu hỏi thường gặp */}
        <section className="mt-14">
          <h2 className={H2}>Câu hỏi thường gặp</h2>
          <div className="border-t border-ga-border">
            {exam.faqs.map((f, i) => (
              <details key={i} className="group border-b border-ga-border py-4">
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
            className="mt-5 inline-flex items-center gap-1.5 text-ga-small font-semibold text-ga-ink underline decoration-ga-yellow decoration-2 underline-offset-4 hover:decoration-ga-ink"
          >
            Lịch thi, lệ phí & đăng ký tại nguồn chính thức <ExternalLink size={14} aria-hidden />
          </a>
        </section>

        <RelatedExams current={exam} />
      </main>
      <LandingFooter />
    </div>
  )
}

function RelatedExams({ current }: { current: GermanExam }) {
  const related = GERMAN_EXAMS.filter((e) => e.slug !== current.slug).slice(0, 3)
  return (
    <section className="mt-14">
      <h2 className={H2}>Các kỳ thi khác</h2>
      <ul className="grid gap-4 sm:grid-cols-3">
        {related.map((e) => (
          <li key={e.slug}>
            <Link
              href={`/luyen-thi/${e.slug}`}
              className="flex h-full flex-col border border-ga-border bg-ga-card p-5 transition-colors hover:border-ga-ink"
            >
              <span className="text-ga-eyebrow uppercase text-ga-muted">{e.provider} · {e.level}</span>
              <span className="mt-2 text-ga-h3 text-ga-ink">{e.name}</span>
              <span className="mt-1 text-ga-small text-ga-muted">{e.tagline}</span>
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
        '@type': 'Course',
        name: exam.metaTitle,
        description: exam.metaDescription,
        url,
        provider: { '@type': 'Organization', name: 'DeutschFlow', url: absoluteUrl('/') },
        about: exam.name,
        inLanguage: 'vi',
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
