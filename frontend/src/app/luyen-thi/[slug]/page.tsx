import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckCircle2, Clock, ExternalLink, GraduationCap, Lightbulb, ListChecks, PenLine, Sparkles } from 'lucide-react'
import { GERMAN_EXAMS, getExamBySlug, totalDurationMin, type GermanExam } from '@/data/germanExams'
import { absoluteUrl } from '@/lib/siteUrl'

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

export default function ExamPage({ params }: { params: { slug: string } }) {
  const exam = getExamBySlug(params.slug)
  if (!exam) notFound()

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <JsonLd exam={exam} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-black via-[#DD0000] to-[#FFCE00]" />
        <div className="absolute right-0 top-0 -mr-16 -mt-10 opacity-10"><GraduationCap size={240} /></div>
        <div className="relative z-10 mx-auto max-w-4xl px-5 pb-12 pt-12 sm:pt-16">
          <nav className="mb-5 text-xs font-semibold text-slate-400">
            <Link href="/luyen-thi" className="hover:text-white">Luyện thi tiếng Đức</Link>
            <span className="px-1.5">/</span>
            <span className="text-slate-300">{exam.shortName}</span>
          </nav>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-indigo-200">
            {exam.provider} · {exam.level}
          </span>
          <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">{exam.name}</h1>
          <p className="mt-3 max-w-2xl text-lg text-slate-300">{exam.tagline}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/free-grade" className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700">
              <Sparkles size={16} /> Chấm thử bài viết miễn phí
            </Link>
            <Link href="/v2/register" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10">
              Luyện thi với DeutschFlow
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-10 px-5 py-10">
        {/* Overview */}
        <section className="space-y-3">
          <p className="text-base leading-relaxed text-slate-700">{exam.overview}</p>
          <p className="rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
            <span className="font-semibold">Dành cho:</span> {exam.whoFor}
          </p>
        </section>

        {/* Modules */}
        <Section icon={<Clock size={18} />} title="Cấu trúc đề thi">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Phần thi</th>
                  <th className="px-5 py-3 hidden sm:table-cell">Nội dung</th>
                  <th className="px-5 py-3 whitespace-nowrap">Thời lượng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exam.modules.map((m) => (
                  <tr key={m.skill}>
                    <td className="px-5 py-3 font-semibold text-slate-800">{m.name}</td>
                    <td className="px-5 py-3 text-slate-500 hidden sm:table-cell">{m.description}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-slate-600">~{m.durationMin} phút</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50/60">
                  <td className="px-5 py-2.5 text-xs font-bold text-slate-600" colSpan={2}>
                    Tổng (tham khảo){exam.modular ? ' · thi/thi lại từng phần' : ''}
                  </td>
                  <td className="px-5 py-2.5 whitespace-nowrap text-xs font-bold text-slate-600">~{totalDurationMin(exam)} phút</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-3 text-sm text-slate-600"><span className="font-semibold">Cách tính điểm:</span> {exam.scoring}</p>
          <p className="text-xs text-slate-400">Thời lượng & cấu trúc mang tính tham khảo — xác nhận tại nguồn chính thức trước khi đăng ký.</p>
        </Section>

        {/* Readiness checklist */}
        <Section icon={<ListChecks size={18} />} title="Checklist sẵn sàng thi">
          <p className="mb-4 text-sm text-slate-600">Tự đánh giá theo từng kỹ năng — nếu còn mục chưa chắc, đó là chỗ cần luyện thêm.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {exam.readiness.map((g) => (
              <div key={g.skill} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="mb-3 text-sm font-bold text-slate-800">{g.skill}</p>
                <ul className="space-y-2">
                  {g.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        {/* CTA mid */}
        <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-white p-6 shadow-sm">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600"><PenLine size={22} /></div>
              <div>
                <p className="text-sm font-bold text-slate-800">Bài viết {exam.level} của bạn được mấy điểm?</p>
                <p className="text-sm text-slate-500">Dán bài Schreiben — AI chấm điểm + nhận xét trong ~15 giây, miễn phí.</p>
              </div>
            </div>
            <Link href="/free-grade" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700">
              <Sparkles size={16} /> Chấm thử ngay
            </Link>
          </div>
        </div>

        {/* Study tips */}
        <Section icon={<Lightbulb size={18} />} title="Mẹo luyện thi">
          <ul className="space-y-2.5">
            {exam.studyTips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">{i + 1}</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* FAQ */}
        <Section icon={<ListChecks size={18} />} title="Câu hỏi thường gặp">
          <div className="space-y-3">
            {exam.faqs.map((f, i) => (
              <details key={i} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <summary className="cursor-pointer list-none text-sm font-bold text-slate-800 marker:hidden">{f.q}</summary>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
          <a href={exam.officialUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            Lịch thi, lệ phí & đăng ký tại nguồn chính thức <ExternalLink size={14} />
          </a>
        </Section>

        {/* Related exams */}
        <RelatedExams current={exam} />
      </div>
    </main>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">{icon}</span>
        <h2 className="text-lg font-black text-slate-800">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function RelatedExams({ current }: { current: GermanExam }) {
  const related = GERMAN_EXAMS.filter((e) => e.slug !== current.slug).slice(0, 3)
  return (
    <section>
      <h2 className="mb-4 text-lg font-black text-slate-800">Các kỳ thi khác</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {related.map((e) => (
          <Link key={e.slug} href={`/luyen-thi/${e.slug}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-500">{e.provider} · {e.level}</span>
            <p className="mt-1 text-sm font-bold text-slate-800">{e.name}</p>
            <p className="mt-1 text-xs text-slate-500">{e.tagline}</p>
          </Link>
        ))}
      </div>
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
