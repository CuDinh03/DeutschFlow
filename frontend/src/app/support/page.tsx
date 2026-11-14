import type { Metadata } from 'next'
import { absoluteUrl } from '@/lib/siteUrl'
import Link from 'next/link'
import '@/styles/galerie.css'
import { GaLogo } from '@/components/ui-v2'
import '@/components/legal/legalGa.css'

export const metadata: Metadata = {
  title: 'Hỗ trợ · myDeutschFlow',
  description:
    'Cần giúp về tài khoản, ứng dụng iPhone, thanh toán hoặc dữ liệu cá nhân? Liên hệ myDeutschFlow qua email support@mydeutschflow.com (Support).',
  alternates: { canonical: absoluteUrl('/support/') },
}

// Footer links — mirrors the legal pages' footer (LegalFooterGa).
const FOOTER_LINKS: [string, string][] = [
  ['Chính sách bảo mật', '/privacy/'],
  ['Điều khoản sử dụng', '/terms/'],
  ['Về chúng tôi', '/about/'],
  ['Trang chủ', '/'],
]

/**
 * /support — the App Store Connect support URL. Rendered in the Galerie homepage
 * theme (`.ga-scope`), matching /privacy and /terms. Static bilingual (EN/VI)
 * content styled via `.ga-legal`; kept as a server component (no switcher needed)
 * so it stays crawlable without JS.
 */
export default function SupportPage() {
  return (
    <div className="ga-scope">
      <main className="min-h-screen bg-ga-bg font-ga-ui text-ga-ink">
        {/* Header — brand left, back-home right (mirrors the legal header) */}
        <header className="sticky top-0 z-50 border-b border-ga-border bg-[color-mix(in_srgb,var(--ga-bg)_92%,transparent)] backdrop-blur-md">
          <div className="mx-auto flex h-[68px] max-w-3xl items-center justify-between gap-4 px-5">
            <Link href="/" aria-label="myDeutschFlow" className="transition-opacity hover:opacity-80">
              <GaLogo size={30} />
            </Link>
            <Link href="/" className="text-[14px] font-semibold text-ga-ink hover:opacity-80">
              Trang chủ
            </Link>
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
          <article className="ga-legal">
            <h1>Hỗ trợ / Support</h1>
            <p>
              Cần hỗ trợ khi dùng myDeutschFlow? Bạn email cho chúng tôi, chúng tôi trả lời trong vòng
              2 ngày làm việc.
            </p>
            <p>
              <strong>Email:</strong>{' '}
              <a href="mailto:support@mydeutschflow.com">support@mydeutschflow.com</a>
            </p>
            <p>Bạn ghi kèm email tài khoản và mô tả ngắn vấn đề, có ảnh chụp màn hình càng tốt.</p>

            <h2>Xoá tài khoản</h2>
            <p>
              Bạn có thể xoá vĩnh viễn tài khoản và dữ liệu trong app iPhone hoặc trên web, ở mục{' '}
              <strong>Hồ sơ</strong>, chọn <strong>Xoá tài khoản</strong>. Nếu không đăng nhập được, hãy
              email cho chúng tôi từ chính địa chỉ email của tài khoản, chúng tôi sẽ xoá giúp bạn.
            </p>

            <h2>Thanh toán và hoàn tiền</h2>
            <p>
              Gói mua trong app iPhone do Apple thu tiền và xử lý hoàn tiền. Bạn gửi yêu cầu tại{' '}
              <a href="https://reportaproblem.apple.com" target="_blank" rel="noopener noreferrer">reportaproblem.apple.com</a>.
              Huỷ gia hạn trong Cài đặt, chạm vào tên của bạn, chọn Đăng ký.
            </p>

            <h2>Chính sách bảo mật và Điều khoản sử dụng</h2>
            <p>
              Xem <a href="/privacy/">Chính sách bảo mật</a> và <a href="/terms/">Điều khoản sử dụng</a>{' '}
              của chúng tôi.
            </p>

            <h2 lang="en">English</h2>
            <p lang="en">
              Need help with myDeutschFlow? Email us at{' '}
              <a href="mailto:support@mydeutschflow.com">support@mydeutschflow.com</a> and we&apos;ll get
              back to you within 2 business days. Please include your account email and a short
              description of the issue (and a screenshot if relevant).
            </p>
            <p lang="en">
              You can permanently delete your account and its data in the iPhone app or on the web:{' '}
              <strong>Profile → Delete account</strong>. If you can&apos;t sign in, email us from your
              account email and we&apos;ll process the deletion. Purchases made in the iPhone app are
              billed and refunded by Apple. See our <a href="/privacy/">Privacy Policy</a> and{' '}
              <a href="/terms/">Terms of Use</a>.
            </p>
          </article>

          {/* Footer — matches the legal pages */}
          <footer className="mt-16 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ga-border pt-6 text-[13px] text-ga-muted">
            {FOOTER_LINKS.map(([label, href], i) => (
              <span key={href} className="flex items-center gap-x-4">
                {i > 0 && <span className="text-ga-faint">·</span>}
                <Link href={href} className="underline underline-offset-2 transition-colors hover:text-ga-ink">
                  {label}
                </Link>
              </span>
            ))}
          </footer>
        </div>
      </main>
    </div>
  )
}
