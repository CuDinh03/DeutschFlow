import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BadgeCheck, ShieldCheck, Sparkles } from 'lucide-react'
import type { Certificate } from '@/lib/certificateApi'
import { CertificateActions } from '@/components/certificate/CertificateActions'

const backendOrigin = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '')
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://mydeutschflow.com').replace(/\/+$/, '')

async function fetchCertificate(token: string): Promise<Certificate | null> {
  try {
    const res = await fetch(`${backendOrigin}/api/public/certificate/${encodeURIComponent(token)}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as Certificate
  } catch {
    return null
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return iso
  }
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const cert = await fetchCertificate(params.token)
  if (!cert) {
    return { title: 'Chứng nhận | DeutschFlow', robots: { index: false, follow: false } }
  }
  const issuer = cert.orgName || 'DeutschFlow'
  const title = `Chứng nhận tiếng Đức ${cert.cefrLevel} — ${cert.studentName} | ${issuer}`
  const description = `Chứng nhận hoàn thành chương trình tiếng Đức trình độ ${cert.cefrLevel}`
    + `${cert.orgName ? ` tại ${cert.orgName}` : ''}. Mã chứng nhận: ${cert.certificateCode}.`
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/certificate/${params.token}/` },
    openGraph: { title, description, url: `${SITE_URL}/certificate/${params.token}/`, type: 'article' },
    // Personal certificate — not for search indexing, but freely viewable/shareable for verification.
    robots: { index: false, follow: true },
  }
}

export default async function CertificatePage({ params }: { params: { token: string } }) {
  const cert = await fetchCertificate(params.token)
  if (!cert) notFound()

  const verifyUrl = `${SITE_URL}/certificate/${params.token}/`
  const issuer = cert.orgName || 'DeutschFlow'

  return (
    <main className="min-h-screen bg-[#f4f1ea] py-10 text-slate-900 print:bg-white print:py-0">
      <div className="mx-auto max-w-3xl px-5 print:max-w-none print:px-0">

        {/* Certificate card */}
        <article className="relative overflow-hidden rounded-[28px] border-[3px] border-emerald-900/15 bg-white shadow-xl shadow-emerald-900/5 print:rounded-none print:border-0 print:shadow-none">
          {/* Top accent bar */}
          <div className="h-2 w-full bg-gradient-to-r from-amber-500 via-emerald-700 to-emerald-900" />

          <div className="px-8 py-10 sm:px-14 sm:py-12">
            {/* Inner ornamental frame */}
            <div className="rounded-2xl ring-1 ring-amber-500/30 ring-offset-4 ring-offset-white">
              <div className="px-2 py-6 text-center sm:px-8">

                {/* Co-brand header */}
                <div className="flex flex-col items-center gap-2">
                  {cert.orgLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cert.orgLogoUrl} alt={issuer} className="mb-1 h-14 w-auto object-contain" />
                  ) : null}
                  <p className="text-lg font-black tracking-tight text-emerald-900">{issuer}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                    {cert.orgName ? 'Đối tác đào tạo · DeutschFlow' : 'Nền tảng luyện thi tiếng Đức'}
                  </p>
                </div>

                <div className="mx-auto my-7 h-px w-24 bg-amber-500/50" />

                {/* Title */}
                <p className="text-xs font-bold uppercase tracking-[0.35em] text-amber-600">Chứng nhận hoàn thành</p>
                <h1 className="mt-2 font-serif text-3xl font-black text-emerald-950 sm:text-4xl">Certificate of Completion</h1>

                {/* Recipient */}
                <p className="mt-8 text-sm text-slate-500">Chứng nhận rằng</p>
                <p className="mt-2 font-serif text-4xl font-bold text-slate-900 sm:text-5xl">{cert.studentName}</p>

                <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-slate-600">
                  đã hoàn thành chương trình học tiếng Đức và đạt trình độ
                </p>

                {/* Level medallion */}
                <div className="mt-5 flex flex-col items-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-900 text-white shadow-lg shadow-emerald-900/25">
                    <span className="font-serif text-4xl font-black">{cert.cefrLevel}</span>
                  </div>
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Khung CEFR (Goethe / telc)</p>
                </div>

                {/* Optional score */}
                {typeof cert.score === 'number' ? (
                  <p className="mt-5 text-sm font-semibold text-slate-700">
                    Kết quả đánh giá: <span className="text-emerald-800">{cert.score}/100</span>
                  </p>
                ) : null}

                {/* Optional teacher remark */}
                {cert.note ? (
                  <p className="mx-auto mt-4 max-w-lg whitespace-pre-line text-sm italic leading-relaxed text-slate-500">
                    “{cert.note}”
                  </p>
                ) : null}

                {/* Footer: date/code + signature */}
                <div className="mt-10 grid grid-cols-1 gap-6 border-t border-slate-100 pt-6 text-left sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ngày cấp</p>
                    <p className="mt-1 text-sm font-bold text-slate-700">{formatDate(cert.issuedAt)}</p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Mã chứng nhận</p>
                    <p className="mt-1 font-mono text-sm font-bold text-slate-700">{cert.certificateCode}</p>
                  </div>
                  <div className="sm:text-right">
                    <p className="font-serif text-lg font-bold text-emerald-900">{cert.issuedByName || issuer}</p>
                    <div className="mt-1 ml-auto h-px w-40 bg-slate-300 sm:ml-auto" />
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Người cấp · {issuer}</p>
                  </div>
                </div>

                {/* Verification strip */}
                <div className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-emerald-800">
                  <ShieldCheck size={16} />
                  <span className="text-xs font-semibold">
                    Chứng nhận hợp lệ · Xác thực tại {verifyUrl.replace(/^https?:\/\//, '')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </article>

        {/* Actions (not printed) */}
        <CertificateActions verifyUrl={verifyUrl} />

        {/* Branded footer + CTA (not printed) */}
        <div className="mt-6 flex flex-col items-center gap-3 print:hidden">
          <div className="flex items-center gap-2 text-slate-400">
            <BadgeCheck size={16} className="text-emerald-600" />
            <span className="text-xs font-bold uppercase tracking-widest">Cấp qua DeutschFlow</span>
          </div>
          <Link
            href="/v2/register"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <Sparkles size={16} /> Luyện thi tiếng Đức với DeutschFlow
          </Link>
        </div>
      </div>
    </main>
  )
}
