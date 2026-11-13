import '@/styles/galerie.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { ShieldCheck, ShieldOff, Sparkles } from 'lucide-react'
import type { Certificate } from '@/lib/certificateApi'
import { CertificateActions } from '@/components/certificate/CertificateActions'
import { GaBtn } from '@/components/ui-v2/GaBtn'
import { GaGlyph } from '@/components/ui-v2/GaGlyph'
import {
  CERTIFICATE_LANGS,
  certificateDict,
  fillCertificateText,
  resolveCertificateLang,
  type CertificateLang,
} from '@/lib/certificateDict'
import { HTML_LANG } from '@/lib/reportSheetDict'
import { serverBackendFetch } from '@/lib/serverBackend'

/**
 * Trang xác thực công khai `/certificate/{token}?lang=vi|en|de` (đợt 4A A+B+E).
 *
 * Đây là chứng nhận HOÀN THÀNH KHOÁ HỌC do trung tâm cấp, không phải chứng chỉ trình độ. Ngôn ngữ đọc
 * từ `?lang` vì người mở (có thể là nhà tuyển dụng) không có phiên đăng nhập; giá trị lạ ⇒ tiếng Việt.
 * Mã QR in trên giấy trỏ về đúng trang này: tờ giấy không có link bấm được, gõ tay 32 ký tự là không thật.
 *
 * Thẻ chia sẻ không mang tên học viên (cùng lý do với phiếu gia đình): link dán vào nhóm chat không
 * được tự bung tên một người ra ô xem trước.
 *
 * Icon đợt B (09/11/2026): màu, chữ, icon theo Galerie (`.ga-scope`, token `ga-*`). Cố ý KHÔNG gắn header/footer
 * công khai: đây là văn bản để in, người mở thường là nhà tuyển dụng, ngôn ngữ đi theo `?lang` chứ không theo
 * nút ngôn ngữ của header tiếng Việt.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://mydeutschflow.com').replace(/\/+$/, '')

/** Khung trang chung của mọi trạng thái (còn hiệu lực, thu hồi, đã xoá). */
const PAGE = 'ga-scope min-h-screen bg-ga-bg font-ga-ui text-ga-ink'

const DATE_LOCALE: Record<CertificateLang, string> = { vi: 'vi-VN', en: 'en-GB', de: 'de-DE' }

type PageProps = {
  params: { token: string }
  searchParams?: Record<string, string | string[] | undefined>
}

async function fetchCertificate(token: string): Promise<Certificate | null> {
  try {
    const res = await serverBackendFetch(`/api/public/certificate/${encodeURIComponent(token)}`, {
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
              ? 'rounded-ga bg-ga-ink px-3 py-1.5 text-ga-caption font-semibold uppercase text-ga-bg'
              : 'rounded-ga px-3 py-1.5 text-ga-caption font-semibold uppercase text-ga-muted hover:bg-ga-card hover:text-ga-ink'
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
      <main lang={HTML_LANG[lang]} className={`${PAGE} py-10`}>
        <div className="mx-auto max-w-3xl px-5">
          {languageSwitch}
          <div role="status" className="flex items-start gap-3 border border-ga-red bg-ga-red-soft px-6 py-5 text-ga-ink">
            <GaGlyph icon={ShieldOff} tone="red" size="sm" />
            <div>
              <p className="text-ga-eyebrow uppercase text-ga-ink">{dict.erasedTitle}</p>
              <p className="mt-1 text-ga-body text-ga-ink">
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
    <main lang={HTML_LANG[lang]} className={`${PAGE} py-10 print:bg-white print:py-0`}>
      <div className="mx-auto max-w-3xl px-5 print:max-w-none print:px-0">
        {languageSwitch}

        {/* Tấm chứng nhận */}
        <article className="relative overflow-hidden border border-ga-border bg-ga-card print:border-0">
          {/* Vạch trên — đỏ khi đã thu hồi để bản in cũng mang dấu hiệu. */}
          <div className={revoked ? 'h-2 w-full bg-ga-red' : 'h-2 w-full bg-ga-yellow'} />

          {revoked ? (
            <div role="status" className="flex items-start gap-3 border-b border-ga-red bg-ga-red-soft px-6 py-4 text-ga-ink sm:px-14">
              <GaGlyph icon={ShieldOff} tone="red" size="sm" />
              <div>
                <p className="text-ga-eyebrow uppercase text-ga-ink">{dict.revokedTitle}</p>
                <p className="mt-1 text-ga-body text-ga-ink">
                  {fillCertificateText(dict.revokedBody, { code: cert.certificateCode, issuer })}
                </p>
              </div>
            </div>
          ) : null}

          <div className="px-5 py-8 sm:px-14 sm:py-12">
            {/* Khung trong */}
            <div className="border border-ga-line p-1">
              <div className="border border-ga-line px-3 py-8 text-center sm:px-8">

                {/* Đầu giấy: trung tâm cấp */}
                <div className="flex flex-col items-center gap-2">
                  {cert.orgLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cert.orgLogoUrl} alt={issuer} className="mb-1 h-14 w-auto object-contain" />
                  ) : null}
                  <p className="font-ga-display text-ga-h2 font-medium text-ga-ink">{issuer}</p>
                  <p className="text-ga-stat-label uppercase text-ga-muted">
                    {cert.orgName ? dict.partnerTagline : dict.platformTagline}
                  </p>
                </div>

                <div className="mx-auto my-7 h-px w-24 bg-ga-gold" />

                <h1 className="font-ga-display text-ga-h1-m font-medium text-ga-ink sm:text-ga-h1">
                  {dict.docTitle}
                </h1>

                {/* Người nhận */}
                <p className="mt-8 text-ga-small text-ga-muted">{dict.certifies}</p>
                <p className="mt-2 break-words font-ga-display text-ga-display font-medium text-ga-ink">{cert.studentName}</p>

                <p className="mx-auto mt-6 max-w-md text-ga-body text-ga-muted">{dict.completed}</p>

                {/* Trình độ khoá học */}
                <div className="mt-5 flex flex-col items-center">
                  <div className="flex h-20 w-20 items-center justify-center bg-ga-ink text-ga-bg">
                    <span className="font-ga-display text-ga-display font-medium">{cert.cefrLevel}</span>
                  </div>
                  <p className="mt-2 text-ga-stat-label uppercase text-ga-muted">{dict.levelCaption}</p>
                  {cert.orgName ? (
                    <p className="mt-2 text-ga-small text-ga-muted">
                      {fillCertificateText(dict.completedAtOrg, { org: cert.orgName })}
                    </p>
                  ) : null}
                </div>

                {/* Điểm chỉ có ở giấy cũ: nút cấp mới không in điểm. */}
                {typeof cert.score === 'number' ? (
                  <p className="mt-5 text-ga-small font-semibold text-ga-ink">
                    {dict.scoreLabel}: <span className="tabular-nums">{cert.score}/100</span>
                  </p>
                ) : null}

                {/* Lời nhận xét tuỳ chọn của giáo viên */}
                {cert.note ? (
                  <p className="mx-auto mt-4 max-w-lg whitespace-pre-line text-ga-body italic text-ga-muted">
                    “{cert.note}”
                  </p>
                ) : null}

                {/* Chân giấy: ngày/mã + chữ ký */}
                <div className="mt-10 grid grid-cols-1 gap-6 border-t border-ga-line pt-6 text-left sm:grid-cols-2">
                  <div>
                    <p className="text-ga-eyebrow uppercase text-ga-muted">{dict.issuedOn}</p>
                    <p className="mt-1 text-ga-body font-semibold text-ga-ink">{formatDate(cert.issuedAt, lang)}</p>
                    <p className="mt-3 text-ga-eyebrow uppercase text-ga-muted">{dict.code}</p>
                    <p className="mt-1 break-all font-mono text-ga-body font-semibold text-ga-ink">{cert.certificateCode}</p>
                  </div>
                  <div className="sm:text-right">
                    <p className="font-ga-display text-ga-h2 font-medium text-ga-ink">{cert.issuedByName || issuer}</p>
                    <div className="mt-1 h-px w-40 bg-ga-line-strong sm:ml-auto" />
                    <p className="mt-1 text-ga-eyebrow uppercase text-ga-muted">{dict.issuer} · {issuer}</p>
                  </div>
                </div>

                <p className="mx-auto mt-6 max-w-lg text-ga-caption text-ga-muted">{dict.disclaimer}</p>

                {/* Dải xác thực */}
                {revoked ? (
                  <div className="mt-6 flex items-center justify-center gap-2 bg-ga-red-soft px-4 py-3">
                    <ShieldOff size={16} className="shrink-0 text-ga-red" aria-hidden />
                    {/* Chữ màu mực: đỏ/xanh trên nền nhạt chỉ ~3–4:1, dòng này là chỗ người kiểm đọc. */}
                    <span className="text-ga-caption font-semibold text-ga-ink [overflow-wrap:anywhere]">
                      {fillCertificateText(dict.revokedStrip, { url: verifyHost })}
                    </span>
                  </div>
                ) : (
                  <div className="mt-6 flex items-center justify-center gap-2 bg-ga-green-soft px-4 py-3">
                    <ShieldCheck size={16} className="shrink-0 text-ga-green" aria-hidden />
                    <span className="text-ga-caption font-semibold text-ga-ink [overflow-wrap:anywhere]">
                      {fillCertificateText(dict.validStrip, { url: verifyHost })}
                    </span>
                  </div>
                )}

                {qr ? (
                  <div className="mt-5 flex flex-col items-center gap-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qr} alt={dict.scanHint} width={96} height={96} className="h-24 w-24" />
                    <p className="text-ga-caption text-ga-muted">{dict.scanHint}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </article>

        {/* Nút in / sao chép (không in ra) */}
        <CertificateActions
          verifyUrl={verifyUrl}
          printLabel={dict.print}
          copyLabel={dict.copyLink}
          copiedLabel={dict.copied}
        />

        {/* Dấu nền tảng + lời mời (không in ra) */}
        <div className="mt-6 flex flex-col items-center gap-3 print:hidden">
          {/* Dấu nền tảng: chữ trơn kiểu eyebrow, không icon (ICON_WEB §2). */}
          <p className="text-ga-eyebrow uppercase text-ga-muted">{dict.issuedVia}</p>
          <GaBtn asChild variant="ghost" size="lg">
            <Link href="/v2/register">
              <Sparkles size={16} aria-hidden /> {dict.cta}
            </Link>
          </GaBtn>
        </div>
      </div>
    </main>
  )
}
