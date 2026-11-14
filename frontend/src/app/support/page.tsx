import type { Metadata } from 'next'
import { absoluteUrl } from '@/lib/siteUrl'
import Link from 'next/link'
import '@/styles/galerie.css'
import '@/components/legal/legalGa.css'
import { PublicShell } from '@/components/landing-v2/PublicShell'
import { APP_STORE_URL, SUPPORT_EMAIL } from '@/components/landing-v2/links'

export const metadata: Metadata = {
  title: 'Hỗ trợ · myDeutschFlow',
  description:
    'Cần giúp về tài khoản, ứng dụng iPhone, thanh toán hoặc dữ liệu cá nhân? Liên hệ myDeutschFlow qua email support@mydeutschflow.com (Support).',
  alternates: { canonical: absoluteUrl('/support/') },
}

/**
 * `/support/` — đường dẫn Hỗ trợ đăng ký trên App Store Connect, hiển thị song ngữ Việt–Anh trên `PublicShell` v3.4
 * dưới dạng Server Component để mọi trình thu thập và kiểm duyệt đọc được không cần JS.
 */
export default function SupportPage() {
  return (
    <PublicShell showLanguage={false} stickyCta={false} mainClassName="mx-auto w-full max-w-[880px] px-5 py-10 sm:px-8 sm:py-14">
      <div className="rounded-ga-xl border border-ga-border bg-ga-card p-6 shadow-ga-sm sm:p-10">
        <div className="mb-4 inline-flex items-center gap-2 rounded-ga-pill border border-ga-border bg-ga-bg px-3.5 py-1 text-ga-eyebrow uppercase text-ga-muted">
          <span className="inline-block h-2 w-2 shrink-0 rounded-ga-pill bg-ga-yellow" />
           Trung tâm trợ giúp · Việt / English
        </div>

        <article className="ga-legal">
          <h1>Hỗ trợ / Support</h1>
          <p>
            Cần hỗ trợ khi dùng myDeutschFlow? Bạn email cho chúng tôi, chúng tôi trả lời trong vòng 2 ngày làm việc.
          </p>

          <div className="my-5 rounded-ga-lg border border-ga-yellow bg-ga-yellow-soft p-4 sm:p-5">
            <p className="!m-0 text-ga-body text-ga-ink">
              <strong>Email hỗ trợ trực tiếp:</strong>{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </p>
            <p className="!mb-0 !mt-1.5 text-ga-small text-ga-muted">
              Bạn ghi kèm email tài khoản và mô tả ngắn vấn đề, có ảnh chụp màn hình càng tốt. Ứng dụng iPhone chính thức trên{' '}
              <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
                App Store
              </a>{' '}
              · máy Android dùng bản web.
            </p>
          </div>

          <h2>Xoá tài khoản</h2>
          <p>
            Bạn có thể xoá vĩnh viễn tài khoản và dữ liệu trong app iPhone hoặc trên web, ở mục <strong>Hồ sơ</strong>, chọn{' '}
            <strong>Xoá tài khoản</strong>. Nếu không đăng nhập được, hãy email cho chúng tôi từ chính địa chỉ email của tài khoản,
            chúng tôi sẽ xoá giúp bạn.
          </p>

          <h2>Thanh toán và hoàn tiền</h2>
          <p>
            Gói mua trong app iPhone do Apple thu tiền và xử lý hoàn tiền. Bạn gửi yêu cầu tại{' '}
            <a href="https://reportaproblem.apple.com" target="_blank" rel="noopener noreferrer">
              reportaproblem.apple.com
            </a>
            . Huỷ gia hạn trong Cài đặt, chạm vào tên của bạn, chọn Đăng ký.
          </p>

          <h2>Chính sách bảo mật và Điều khoản sử dụng</h2>
          <p>
            Xem <Link href="/privacy/">Chính sách bảo mật</Link> và <Link href="/terms/">Điều khoản sử dụng</Link> của chúng tôi.
          </p>

          <hr />

          <h2 lang="en">English Support</h2>
          <p lang="en">
            Need help with myDeutschFlow? Email us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we&apos;ll get
            back to you within 2 business days. Please include your account email and a short description of the issue (and a
            screenshot if relevant).
          </p>
          <p lang="en">
            You can permanently delete your account and its data in the iPhone app or on the web:{' '}
            <strong>Profile → Delete account</strong>. If you can&apos;t sign in, email us from your account email and we&apos;ll
            process the deletion. Purchases made in the iPhone app are billed and refunded by Apple. See our{' '}
            <Link href="/privacy/">Privacy Policy</Link> and <Link href="/terms/">Terms of Use</Link>.
          </p>
        </article>
      </div>
    </PublicShell>
  )
}
