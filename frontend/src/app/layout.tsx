import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { Toaster } from '@/components/ui/sonner'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import { PostHogProvider } from '@/providers/PostHogProvider'
import { NativeAuthProvider } from '@/providers/NativeAuthProvider'
import { AuthRecoveryDialog } from '@/components/auth/AuthRecoveryDialog'
import './globals.css'

const inter = Inter({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  display: 'swap',
  variable: '--font-inter',
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
    <html lang={locale} className={inter.variable}>
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <PostHogProvider>
            <NativeAuthProvider>
              {children}
              <AuthRecoveryDialog />
              <Toaster position="top-center" />
            </NativeAuthProvider>
          </PostHogProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
