export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { Toaster } from '@/components/ui/sonner'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import './globals.css'

const inter = Inter({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  display: 'swap',
  variable: '--font-inter',
})

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
        <NextIntlClientProvider messages={messages}>
          {children}
          <Toaster position="top-center" />

        </NextIntlClientProvider>
      </body>
    </html>
  )
}
