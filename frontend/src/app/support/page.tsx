import type { Metadata } from 'next'
import Link from 'next/link'
import '@/styles/galerie.css'
import { GaLogo } from '@/components/ui-v2'
import '@/components/legal/legalGa.css'

export const metadata: Metadata = {
  title: 'Support · myDeutschFlow',
  description: 'myDeutschFlow support / Hỗ trợ.',
}

// Footer links — mirrors the legal pages' footer (LegalFooterGa).
const FOOTER_LINKS: [string, string][] = [
  ['Chính sách bảo mật', '/privacy'],
  ['Điều khoản sử dụng', '/terms'],
  ['Về chúng tôi', '/about'],
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
        <header className="sticky top-0 z-50 border-b border-ga-border bg-ga-bg/90 backdrop-blur-md">
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
              Cần trợ giúp với myDeutschFlow? / Need help with myDeutschFlow? Email cho chúng tôi và
              bạn sẽ nhận phản hồi trong vòng 2 ngày làm việc. / Email us and we&apos;ll get back to
              you within 2 business days.
            </p>
            <p>
              <strong>Email:</strong>{' '}
              <a href="mailto:dinhhuycu0305@gmail.com">dinhhuycu0305@gmail.com</a>
            </p>
            <p>
              Vui lòng kèm email tài khoản và mô tả ngắn gọn vấn đề (kèm ảnh chụp màn hình nếu có). /
              Please include your account email and a short description of the issue (and a screenshot
              if relevant).
            </p>

            <h2>Xoá tài khoản / Account deletion</h2>
            <p>
              Bạn có thể xoá vĩnh viễn tài khoản và dữ liệu ngay trong ứng dụng:{' '}
              <strong>Hồ sơ (Profile) → Xoá tài khoản (Delete account)</strong>. Nếu không đăng nhập
              được, hãy email từ chính địa chỉ email tài khoản của bạn và chúng tôi sẽ xử lý việc
              xoá. / You can permanently delete your account and its data directly in the app:{' '}
              <strong>Profile → Delete account</strong>. If you can&apos;t sign in, email the address
              above from your account email and we&apos;ll process the deletion.
            </p>

            <h2>Quyền riêng tư &amp; Điều khoản / Privacy &amp; Terms</h2>
            <p>
              Xem <a href="/privacy">Chính sách bảo mật</a> và{' '}
              <a href="/terms">Điều khoản sử dụng</a> của chúng tôi. / See our{' '}
              <a href="/privacy">Privacy Policy</a> and <a href="/terms">Terms of Use</a>.
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
