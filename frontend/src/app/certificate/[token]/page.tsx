import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { BadgeCheck, ShieldCheck, ShieldOff, Sparkles } from 'lucide-react'
import type { Certificate } from '@/lib/certificateApi'
import { CertificateActions } from '@/components/certificate/CertificateActions'
import {
  CERTIFICATE_LANGS,
  certificateDict,
  fillCertificateText,
  resolveCertificateLang,
  type CertificateLang,
} from '@/lib/certificateDict'
import { HTML_LANG } from '@/lib/reportSheetDict'

/**
 * Trang xác thực công khai `/certificate/{token}?lang=vi|en|de` (đợt 4A A+B+E).
 *
 * Đây là chứng nhận HOÀN THÀNH KHOÁ HỌC do trung tâm cấp, không phải chứng chỉ trình độ. Ngôn ngữ đọc
 * từ `?lang` vì người mở (có thể là nhà tuyển dụng) không có phiên đăng nhập; giá trị lạ ⇒ tiếng Việt.
 * Mã QR in trên giấy trỏ về đúng trang này: tờ giấy không có link bấm được, gõ tay 32 ký tự là không thật.
 *
 * Thẻ chia sẻ không mang tên học viên (cùng lý do với phiếu gia đình): link dán vào nhóm chat không
 * được tự bung tên một người ra ô xem trước.
 */

const backendOrigin = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '')
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://mydeutschflow.com').replace(/\/+$/, '')

const DATE_LOCALE: Record<CertificateLang, string> = { vi: 'vi-VN', en: 'en-GB', de: 'de-DE' }

type PageProps = {
  params: { token: string }
  searchParams?: Record<string, string | string[] | undefined>
}

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

function formatDate(iso: string, lang: CertificateLang): string {
  try {
    return new Date(iso).toLocaleDateString(DATE_LOCALE[lang], { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return iso
  }
}

/** SVG của mã QR dạng data URI; lỗi thì không hiện mã, giấy vẫn còn URL bằng chữ. */
async function qrDataUri(url: string): Promise<string | null> {
  try {
    const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  } catch {
    return null
  }
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const dict = certificateDict(resolveCertificateLang(searchParams?.lang))
  const cert = await fetchCertificate(params.token)
  if (!cert) {
    return { title: `${dict.docTitle} | DeutschFlow`, robots: { index: false, follow: false } }
  }
  // DEC-20: chứng nhận đã thu hồi vẫn về 200 (active=false) — tiêu đề phải nói thẳng, không để
  // thẻ chia sẻ của một tờ giấy đã rút vẫn khoe như giấy còn hiệu lực.
  if (!cert.active) {
    const title = cert.erased ? dict.erasedTitle : dict.revokedTitle
    return {
      title: `${title} — ${cert.certificateCode} | DeutschFlow`,
      description: title,
      robots: { index: false, follow: false },
    }
  }
  const issuer = cert.orgName || 'DeutschFlow'
  const title = `${dict.docTitle} ${cert.cefrLevel} | ${issuer}`
  return {
    title,
    description: `${title} · ${cert.certificateCode}`,
    alternates: { canonical: `${SITE_URL}/certificate/${params.token}/` },
    openGraph: { title, url: `${SITE_URL}/certificate/${params.token}/`, type: 'article' },
    // Personal certificate — not for search indexing, but freely viewable/shareable for verification.
    robots: { index: false, follow: true },
  }
}

export default async function CertificatePage({ params, searchParams }: PageProps) {
  const cert = await fetchCertificate(params.token)
  if (!cert) notFound()

  const lang = resolveCertificateLang(searchParams?.lang)
  const dict = certificateDict(lang)
  const issuer = cert.orgName || 'DeutschFlow'
  const pagePath = `/certificate/${params.token}/`

  const languageSwitch = (
    <nav aria-label={dict.languageLabel} className="mb-4 flex justify-end gap-1 print:hidden">
      {CERTIFICATE_LANGS.map((code) => (
        <Link
          key={code}
          href={`${pagePath}?lang=${code}`}
          aria-current={code === lang ? 'true' : undefined}
          className={
            code === lang
              ? 'rounded-lg bg-emerald-900 px-3 py-1.5 text-xs font-bold uppercase text-white'
              : 'rounded-lg px-3 py-1.5 text-xs font-bold uppercase text-slate-500 hover:bg-white'
          }
        >
          {code}
        </Link>
      ))}
    </nav>
  )

  // Học viên đã xoá tài khoản: không còn gì để đối chiếu, chỉ báo giấy hết hiệu lực. Không dựng tấm
  // chứng nhận, không có QR, để trang không trông như một giấy còn tên người.
  if (cert.erased) {
    return (
      <main lang={HTML_LANG[lang]} className="min-h-screen bg-[#f4f1ea] py-10 text-slate-900">
        <div className="mx-auto max-w-3xl px-5">
          {languageSwitch}
          <div role="status" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-red-900">
            <ShieldOff size={20} className="mt-0.5 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-black uppercase tracking-wider">{dict.erasedTitle}</p>
              <p className="mt-1 text-sm leading-relaxed text-red-800">
                {fillCertificateText(dict.erasedBody, { code: cert.certificateCode, issuer })}
              </p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  const verifyUrl = `${SITE_URL}${pagePath}?lang=${lang}`
  const verifyHost = verifyUrl.replace(/^https?:\/\//, '')
  const qr = await qrDataUri(verifyUrl)
  // DEC-20: thu hồi (giáo viên phụ trách hoặc giám đốc trung tâm) KHÔNG làm link 404 — ai cầm bản
  // in quét mã phải đọc được "đã thu hồi" thay vì "không tồn tại" (404 không phân biệt được giấy
  // giả với giấy bị rút). Tấm chứng nhận vẫn hiện nguyên để đối chiếu, nhưng bị đóng dấu rõ ràng.
  const revoked = !cert.active

  return (
    <main lang={HTML_LANG[lang]} className="min-h-screen bg-[#f4f1ea] py-10 text-slate-900 print:bg-white print:py-0">
      <div className="mx-auto max-w-3xl px-5 print:max-w-none print:px-0">
        {languageSwitch}

        {/* Certificate card */}
        <article className="relative overflow-hidden rounded-[28px] border-[3px] border-emerald-900/15 bg-white shadow-xl shadow-emerald-900/5 print:rounded-none print:border-0 print:shadow-none">
          {/* Top accent bar — đỏ khi đã thu hồi để bản in cũng mang dấu hiệu. */}
          <div
            className={
              revoked
                ? 'h-2 w-full bg-gradient-to-r from-red-500 via-red-700 to-red-900'
                : 'h-2 w-full bg-gradient-to-r from-amber-500 via-emerald-700 to-emerald-900'
            }
          />

          {revoked ? (
            <div role="status" className="flex items-start gap-3 border-b border-red-200 bg-red-50 px-8 py-4 text-red-900 sm:px-14">
              <ShieldOff size={20} className="mt-0.5 shrink-0" aria-hidden />
              <div>
                <p className="text-sm font-black uppercase tracking-wider">{dict.revokedTitle}</p>
                <p className="mt-1 text-sm leading-relaxed text-red-800">
                  {fillCertificateText(dict.revokedBody, { code: cert.certificateCode, issuer })}
                </p>
              </div>
            </div>
          ) : null}

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
                    {cert.orgName ? dict.partnerTagline : dict.platformTagline}
                  </p>
                </div>

                <div className="mx-auto my-7 h-px w-24 bg-amber-500/50" />

                {/* Title */}
                <h1 className="font-serif text-3xl font-black text-emerald-950 sm:text-4xl">{dict.docTitle}</h1>

                {/* Recipient */}
                <p className="mt-8 text-sm text-slate-500">{dict.certifies}</p>
                <p className="mt-2 font-serif text-4xl font-bold text-slate-900 sm:text-5xl">{cert.studentName}</p>

                <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-slate-600">
                  {dict.completed}
                </p>

                {/* Level medallion */}
                <div className="mt-5 flex flex-col items-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-900 text-white shadow-lg shadow-emerald-900/25">
                    <span className="font-serif text-4xl font-black">{cert.cefrLevel}</span>
                  </div>
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{dict.levelCaption}</p>
                  {cert.orgName ? (
                    <p className="mt-2 text-sm text-slate-600">
                      {fillCertificateText(dict.completedAtOrg, { org: cert.orgName })}
                    </p>
                  ) : null}
                </div>

                {/* Điểm chỉ có ở giấy cũ: nút cấp mới không in điểm. */}
                {typeof cert.score === 'number' ? (
                  <p className="mt-5 text-sm font-semibold text-slate-700">
                    {dict.scoreLabel}: <span className="text-emerald-800">{cert.score}/100</span>
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
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{dict.issuedOn}</p>
                    <p className="mt-1 text-sm font-bold text-slate-700">{formatDate(cert.issuedAt, lang)}</p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{dict.code}</p>
                    <p className="mt-1 font-mono text-sm font-bold text-slate-700">{cert.certificateCode}</p>
                  </div>
                  <div className="sm:text-right">
                    <p className="font-serif text-lg font-bold text-emerald-900">{cert.issuedByName || issuer}</p>
                    <div className="mt-1 ml-auto h-px w-40 bg-slate-300 sm:ml-auto" />
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{dict.issuer} · {issuer}</p>
                  </div>
                </div>

                <p className="mx-auto mt-6 max-w-lg text-xs leading-relaxed text-slate-500">{dict.disclaimer}</p>

                {/* Verification strip */}
                {revoked ? (
                  <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-red-800">
                    <ShieldOff size={16} className="shrink-0" aria-hidden />
                    <span className="break-all text-xs font-semibold">
                      {fillCertificateText(dict.revokedStrip, { url: verifyHost })}
                    </span>
                  </div>
                ) : (
                  <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-emerald-800">
                    <ShieldCheck size={16} className="shrink-0" aria-hidden />
                    <span className="break-all text-xs font-semibold">
                      {fillCertificateText(dict.validStrip, { url: verifyHost })}
                    </span>
                  </div>
                )}

                {qr ? (
                  <div className="mt-5 flex flex-col items-center gap-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qr} alt={dict.scanHint} width={96} height={96} className="h-24 w-24" />
                    <p className="text-[11px] text-slate-500">{dict.scanHint}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </article>

        {/* Actions (not printed) */}
        <CertificateActions
          verifyUrl={verifyUrl}
          printLabel={dict.print}
          copyLabel={dict.copyLink}
          copiedLabel={dict.copied}
        />

        {/* Branded footer + CTA (not printed) */}
        <div className="mt-6 flex flex-col items-center gap-3 print:hidden">
          <div className="flex items-center gap-2 text-slate-400">
            <BadgeCheck size={16} className="text-emerald-600" />
            <span className="text-xs font-bold uppercase tracking-widest">{dict.issuedVia}</span>
          </div>
          <Link
            href="/v2/register"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <Sparkles size={16} /> {dict.cta}
          </Link>
        </div>
      </div>
    </main>
  )
}
