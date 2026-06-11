import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, GraduationCap, Sparkles } from 'lucide-react'
import { GERMAN_EXAMS } from '@/data/germanExams'
import { absoluteUrl } from '@/lib/siteUrl'

export const metadata: Metadata = {
  title: 'Luyện thi tiếng Đức: Goethe & telc (A2/B1/B2) — Cấu trúc & checklist',
  description:
    'Hướng dẫn luyện thi các chứng chỉ tiếng Đức Goethe và telc (A2, B1, B2, Pflege): cấu trúc đề, cách tính điểm, checklist sẵn-sàng-thi theo kỹ năng. Chấm thử bài viết bằng AI miễn phí.',
  alternates: { canonical: absoluteUrl('/luyen-thi/') },
  robots: { index: true, follow: true },
}

export default function ExamHubPage() {
  const byProvider = {
    Goethe: GERMAN_EXAMS.filter((e) => e.provider === 'Goethe'),
    telc: GERMAN_EXAMS.filter((e) => e.provider === 'telc'),
  }

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: GERMAN_EXAMS.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: e.name,
      url: absoluteUrl(`/luyen-thi/${e.slug}/`),
    })),
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />

      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-black via-[#DD0000] to-[#FFCE00]" />
        <div className="absolute right-0 top-0 -mr-16 -mt-10 opacity-10"><GraduationCap size={240} /></div>
        <div className="relative z-10 mx-auto max-w-4xl px-5 pb-12 pt-14 sm:pt-20">
          <h1 className="text-4xl font-black leading-tight sm:text-5xl">Luyện thi tiếng Đức</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-300">
            Cấu trúc đề, cách tính điểm và <span className="font-semibold text-white">checklist sẵn-sàng-thi</span> cho
            các chứng chỉ Goethe & telc. Chọn kỳ thi của bạn bên dưới.
          </p>
          <Link href="/free-grade" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700">
            <Sparkles size={16} /> Chấm thử bài viết B1 miễn phí
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-10 px-5 py-10">
        {(['Goethe', 'telc'] as const).map((provider) => (
          <section key={provider}>
            <h2 className="mb-4 text-lg font-black text-slate-800">Chứng chỉ {provider}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {byProvider[provider].map((e) => (
                <Link
                  key={e.slug}
                  href={`/luyen-thi/${e.slug}`}
                  className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
                >
                  <span className="inline-flex w-fit items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-indigo-600">
                    {e.provider} · {e.level}
                  </span>
                  <p className="mt-2 text-base font-bold text-slate-800">{e.name}</p>
                  <p className="mt-1 flex-1 text-sm text-slate-500">{e.tagline}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 group-hover:gap-2">
                    Xem hướng dẫn <ArrowRight size={15} />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
