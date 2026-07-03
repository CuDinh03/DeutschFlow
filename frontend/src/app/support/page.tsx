import type { Metadata } from 'next'
import { LegalFooter } from '@/components/legal/LegalDoc'

export const metadata: Metadata = {
  title: 'Support · DeutschFlow',
  description: 'DeutschFlow support / Hỗ trợ.',
}

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-5 py-12">
        <article className="legal-doc">
          <h1>DeutschFlow — Support / Hỗ trợ</h1>
          <p>
            Need help with DeutschFlow? / Cần trợ giúp với DeutschFlow? Email us and we&apos;ll get
            back to you within 2 business days.
          </p>
          <p>
            <strong>Email:</strong>{' '}
            <a href="mailto:dinhhuycu0305@gmail.com">dinhhuycu0305@gmail.com</a>
          </p>
          <p>
            Please include your account email and a short description of the issue (and a screenshot
            if relevant). / Vui lòng kèm email tài khoản và mô tả ngắn gọn vấn đề.
          </p>

          <h2>Account deletion / Xoá tài khoản</h2>
          <p>
            You can permanently delete your account and its data directly in the app:{' '}
            <strong>Profile (Hồ sơ) → Delete account (Xoá tài khoản)</strong>. If you can&apos;t sign
            in, email the address above from your account email and we&apos;ll process the deletion.
          </p>

          <h2>Privacy &amp; Terms</h2>
          <p>
            See our <a href="/privacy">Privacy Policy</a> and <a href="/terms">Terms of Use</a>.
          </p>
        </article>
        <LegalFooter />
      </div>
    </main>
  )
}
