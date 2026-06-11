import type { Metadata } from 'next'
import Link from 'next/link'
import { Gift, Check, FileText, ScanLine, Award, Share2, Sparkles, GraduationCap, Infinity as InfinityIcon } from 'lucide-react'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://mydeutschflow.com').replace(/\/+$/, '')

export const metadata: Metadata = {
  title: 'Gói miễn phí cho giáo viên tiếng Đức — Chấm bài AI không giới hạn | DeutschFlow',
  description:
    'Giáo viên tiếng Đức tự do: chấm bài viết bằng AI không giới hạn, cấp chứng nhận đồng thương hiệu, '
    + 'chia sẻ kết quả qua Zalo — hoàn toàn miễn phí. Đăng ký dạy với DeutschFlow.',
  alternates: { canonical: `${SITE_URL}/giao-vien-mien-phi/` },
  openGraph: {
    title: 'Dạy tiếng Đức với AI — Miễn phí cho giáo viên tự do | DeutschFlow',
    description: 'Chấm bài viết AI không giới hạn + chứng nhận đồng thương hiệu + chia sẻ Zalo. Miễn phí.',
    url: `${SITE_URL}/giao-vien-mien-phi/`,
    type: 'website',
  },
}

const FREE = [
  { icon: <InfinityIcon size={18} />, title: 'Chấm bài viết (Schreiben) không giới hạn', desc: 'AI chấm điểm + nhận xét chi tiết cho mọi bài viết của học viên — không giới hạn số lượt.' },
  { icon: <Award size={18} />, title: 'Chứng nhận đồng thương hiệu', desc: 'Cấp chứng nhận hoàn thành cho học viên, gắn tên/logo của bạn — in được, xác thực công khai.' },
  { icon: <Share2 size={18} />, title: 'Chia sẻ kết quả qua Zalo', desc: 'Mỗi bài chấm tạo một report đẹp để chia sẻ — học viên tự hào, bạn được lan toả.' },
  { icon: <GraduationCap size={18} />, title: 'Công cụ luyện thi đầy đủ', desc: 'Từ vựng, ngữ pháp, luyện nói AI, mock exam Goethe/telc — sẵn cho lớp của bạn.' },
]

const CAPPED = [
  { icon: <FileText size={18} />, title: 'Tạo bài giảng PPTX bằng AI', limit: '2 lượt/ngày' },
  { icon: <ScanLine size={18} />, title: 'Chấm ảnh bài viết tay (OCR)', limit: '5 lượt/ngày' },
]

export default function FreeTeacherLandingPage() {
  return (
    <main className="min-h-screen bg-[#f4f7f6] text-slate-900">
      <div className="mx-auto max-w-3xl px-5 py-14">
        {/* Hero */}
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-700">
            <Gift size={14} /> Miễn phí cho giáo viên
          </span>
          <h1 className="mt-5 font-serif text-4xl font-black leading-tight text-emerald-950 sm:text-5xl">
            Dạy tiếng Đức với AI —<br />miễn phí cho giáo viên tự do
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-600">
            Chấm bài viết không giới hạn, cấp chứng nhận mang thương hiệu của bạn, và chia sẻ kết quả —
            không mất phí, không cần thẻ tín dụng.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-700/20 transition hover:bg-emerald-800"
            >
              <Sparkles size={16} /> Đăng ký dạy miễn phí
            </Link>
            <Link
              href="/free-grade"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Chấm thử 1 bài ngay
            </Link>
          </div>
        </div>

        {/* What's free */}
        <section className="mt-14">
          <h2 className="mb-5 text-center text-sm font-bold uppercase tracking-[0.2em] text-emerald-600">Miễn phí trọn gói</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FREE.map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">{f.icon}</div>
                <h3 className="flex items-center gap-1.5 text-base font-bold text-slate-800">
                  <Check size={16} className="shrink-0 text-emerald-600" /> {f.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Capped */}
        <section className="mt-10 rounded-2xl border border-amber-100 bg-amber-50/50 p-6">
          <h2 className="text-sm font-bold text-slate-800">Tính năng AI nặng — có hạn mức/ngày</h2>
          <p className="mt-1 text-sm text-slate-500">
            Một vài tính năng tốn tài nguyên có giới hạn nhẹ mỗi ngày ở gói miễn phí. Tham gia một tổ chức để dùng nhiều hơn.
          </p>
          <div className="mt-4 space-y-2">
            {CAPPED.map((c) => (
              <div key={c.title} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span className="text-amber-600">{c.icon}</span> {c.title}
                </span>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">{c.limit}</span>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-12 rounded-3xl bg-gradient-to-br from-emerald-800 to-emerald-950 p-8 text-center text-white">
          <h2 className="text-2xl font-black">Bắt đầu trong 2 phút</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-emerald-100">
            Đăng ký tài khoản giáo viên, tạo lớp, và để AI lo phần chấm bài. Hoàn toàn miễn phí.
          </p>
          <Link
            href="/register"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-emerald-900 transition hover:bg-emerald-50"
          >
            <Sparkles size={16} /> Đăng ký dạy miễn phí
          </Link>
        </section>

        <p className="mt-8 text-center text-xs text-slate-400">
          DeutschFlow — nền tảng luyện thi tiếng Đức Goethe/telc với AI.
        </p>
      </div>
    </main>
  )
}
