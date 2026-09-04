import type { Metadata, Viewport } from 'next'
import { Inter, Newsreader, Be_Vietnam_Pro } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale } from 'next-intl/server'
import { messagesForV2Areas } from '@/i18n/pickV2Messages'
import { Toaster } from '@/components/ui/sonner'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import { PostHogProvider } from '@/providers/PostHogProvider'
import { NativeAuthProvider } from '@/providers/NativeAuthProvider'
import { MotionProvider } from '@/providers/MotionProvider'
import { AuthRecoveryDialog } from '@/components/auth/AuthRecoveryDialog'
import { MaintenanceOverlay } from '@/components/system/MaintenanceOverlay'
import { SITE_URL } from '@/lib/siteUrl'
import './globals.css'

const inter = Inter({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  display: 'swap',
  variable: '--font-inter',
})

// ── Galerie 2.0 (UI 2.0) type — self-hosted via next/font; exposed as CSS vars
// consumed ONLY inside `.ga-scope` (see src/styles/galerie.css). Legacy Inter body giữ nguyên
// CHỈ cho cây legacy trong thời gian migration (D1 approved 26/08/2026).
// Italic được tải thật vì landing (GaLanding) dùng emphasis italic cho trích dẫn/nhãn Đức —
// trước đây trình duyệt phải synthesize (faux italic) do chỉ tải style normal.
const newsreader = Newsreader({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-newsreader',
})
// Be Vietnam Pro — UI sans DUY NHẤT của Galerie (D1: thay Instrument Sans vốn không có subset
// `vietnamese` → UI tiếng Việt từng render trộn glyph với system-ui). Chỉ 3 weight Design System
// cho phép (DS §3.1: ui 400/500/600) — KHÔNG tải 700.
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-be-vietnam-pro',
})

// Do NOT lock zoom — `maximumScale: 1` / `userScalable: false` is a WCAG 1.4.4 (Resize
// Text) failure that blocks low-vision users from pinch-zooming. Double-tap / input-focus
// auto-zoom is suppressed instead via `touch-action: manipulation` on interactive elements
// (see globals.css). `viewportFit: 'cover'` lets the webview draw into safe-area regions so
// our env(safe-area-inset-*) padding rules can position content correctly.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'DeutschFlow — Learn German with AI',
  description: 'Learn German with color-coded grammar, AI speaking coach, and spaced repetition',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'DeutschFlow',
    description: 'Learn German with AI',
    images: ['/icon.svg'],
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  // W2 audit lag 02/09: TRƯỚC serialize trọn catalog (~245KB) vào HTML của MỌI trang. Provider
  // gốc giờ chỉ mang phần các bề mặt NGOÀI 4 khu role cần (landing, login/register, onboarding,
  // profile/payment, messages, org-accept); mỗi khu role tự bọc provider với phần của khu trong
  // layout của nó (src/app/v2/<khu>/layout.tsx) — provider trong ĐÈ provider ngoài.
  //   - auth + onboarding + account: các trang v2 lẻ ngoài khu.
  //   - org.accept: trang (public)/org/accept nhận lời mời.
  //   - student.micGuide: MicDeniedGuide render trong onboarding/mock-exam.
  const messages = await messagesForV2Areas('auth', 'onboarding', 'account', 'org.accept', 'student.micGuide')

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${newsreader.variable} ${beVietnamPro.variable}`}
    >
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <PostHogProvider>
            <NativeAuthProvider>
              <MotionProvider>
                {children}
                <AuthRecoveryDialog />
                {/* Màn chặn bảo trì toàn cục — cùng pattern mount với AuthRecoveryDialog
                    (interceptor bắn tín hiệu vào store, overlay render theo store). */}
                <MaintenanceOverlay />
                <Toaster position="top-center" />
              </MotionProvider>
            </NativeAuthProvider>
          </PostHogProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
