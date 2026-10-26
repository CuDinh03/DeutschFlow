import type { Metadata, Viewport } from 'next'
import { Inter, Newsreader, Be_Vietnam_Pro } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import { messagesForV2Areas } from '@/i18n/pickV2Messages'
import { Toaster } from '@/components/ui/sonner'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import { PostHogProvider } from '@/providers/PostHogProvider'
import { NativeAuthProvider } from '@/providers/NativeAuthProvider'
import { MotionProvider } from '@/providers/MotionProvider'
import { AuthRecoveryDialog } from '@/components/auth/AuthRecoveryDialog'
import { MaintenanceOverlay } from '@/components/system/MaintenanceOverlay'
import { DEFAULT_OG_IMAGE, SITE_URL } from '@/lib/siteUrl'
import './globals.css'

// ── Không preload font (đợt A tốc độ trang chủ, 26/10/2026) ──────────────────────────────────
// Trước: cả ba họ preload đủ mọi subset → MỌI trang gửi 18 gợi ý preload (13 thành thẻ <link> trong
// HTML, ~300KB) chen trước JS/CSS; trên 4G chậm chúng giành băng thông với chính tài nguyên vẽ
// trang — tiêu đề trang chủ hiện ở 5,4 s. `display: 'swap'` + fallback chỉnh metric (next/font
// `adjustFontFallback`, mặc định bật) cho chữ hiện ngay bằng font hệ thống rồi đổi êm, nên không
// cần preload: trình duyệt tự tải đúng file trang dùng (theo `unicode-range` + weight) ngay khi
// CSS dựng xong.
//
// Đã thử chỉ preload Newsreader (font h1): Next 14.2 đẩy gợi ý preload vào luồng RSC, và các gợi
// ý nằm ở đầu luồng KHÔNG thành thẻ <link> trong HTML (đo trên bản main: 5/18 gợi ý rơi mất) —
// 4 gợi ý Newsreader rơi trọn, chỉ còn chạy khi JS khởi động, tức muộn hơn chính CSS. Nên tắt hẳn
// cho rõ ràng thay vì để một preload chỉ có trên giấy.

// Inter chỉ còn cho cây legacy (body ngoài `.ga-scope`).
const inter = Inter({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  display: 'swap',
  preload: false,
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
  preload: false,
  variable: '--font-newsreader',
})
// Be Vietnam Pro — UI sans DUY NHẤT của Galerie (D1: thay Instrument Sans vốn không có subset
// `vietnamese` → UI tiếng Việt từng render trộn glyph với system-ui). Chỉ 3 weight Design System
// cho phép (DS §3.1: ui 400/500/600) — KHÔNG tải 700.
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  weight: ['400', '500', '600'],
  display: 'swap',
  preload: false,
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

/**
 * Metadata gốc — áp cho mọi trang không tự khai (trang chủ `/` và /v2 không khai riêng).
 *
 * 18/10/2026 (đợt 0, định hướng A+B+E): trước là chuỗi cứng tiếng Anh "DeutschFlow — Learn German
 * with AI" cho MỌI locale, trong khi catalog `v2.landing.meta` đã có title/description ba thứ tiếng
 * mà không ai đọc. Nay đọc catalog theo locale của request, thương hiệu thống nhất "myDeutschFlow".
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('v2.landing.meta')
  const title = t('title')
  const description = t('description')
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    // `/favicon.ico` cho trình duyệt/công cụ tự xin đường dẫn cố định (từng 404); SVG cho trình
    // duyệt hiện đại; iOS "Thêm vào màn hình chính" chỉ nhận PNG. Cả ba sinh từ public/icon.svg
    // bằng `node scripts/generate-web-icons.mjs`.
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: '48x48' },
        { url: '/icon.svg', type: 'image/svg+xml' },
      ],
      shortcut: '/favicon.ico',
      apple: { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    },
    manifest: '/manifest.json',
    openGraph: {
      title,
      description,
      siteName: 'myDeutschFlow',
      images: [DEFAULT_OG_IMAGE],
    },
  }
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
  //   - landing: trang chủ `/` (GaLanding) — 06/09/2026 dịch vi/en/de (F-I18N-02a).
  //   - base:nav: LanguageSwitcher ngay trong layout này (nhãn ngôn ngữ) — catalog gốc còn lại
  //     (`learn`, `speaking`) chỉ khu student cần, xem src/app/v2/student/layout.tsx.
  const messages = await messagesForV2Areas('landing', 'base:nav')

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
