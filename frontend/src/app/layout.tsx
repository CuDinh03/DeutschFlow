import type { Metadata, Viewport } from 'next'
import { Inter, Newsreader, Instrument_Sans, Be_Vietnam_Pro } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { Toaster } from '@/components/ui/sonner'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import { PostHogProvider } from '@/providers/PostHogProvider'
import { NativeAuthProvider } from '@/providers/NativeAuthProvider'
import { MotionProvider } from '@/providers/MotionProvider'
import { AuthRecoveryDialog } from '@/components/auth/AuthRecoveryDialog'
import { SITE_URL } from '@/lib/siteUrl'
import './globals.css'

const inter = Inter({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  display: 'swap',
  variable: '--font-inter',
})

// ── Galerie 2.0 (UI 2.0) type — self-hosted via next/font; exposed as CSS vars
// consumed ONLY inside `.ga-scope` (see src/styles/galerie.css). Legacy Inter body unchanged.
const newsreader = Newsreader({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  display: 'swap',
  variable: '--font-newsreader',
})
const instrumentSans = Instrument_Sans({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-instrument-sans',
})
// Be Vietnam Pro — full Vietnamese diacritic coverage (Instrument Sans lacks the `vietnamese`
// subset). Used for the learning-tree surface (labels/chips/tooltip + SVG text) via `--ga-vn`.
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
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
  const messages = await getMessages()

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${newsreader.variable} ${instrumentSans.variable} ${beVietnamPro.variable}`}
    >
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <PostHogProvider>
            <NativeAuthProvider>
              <MotionProvider>
                {children}
                <AuthRecoveryDialog />
                <Toaster position="top-center" />
              </MotionProvider>
            </NativeAuthProvider>
          </PostHogProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
