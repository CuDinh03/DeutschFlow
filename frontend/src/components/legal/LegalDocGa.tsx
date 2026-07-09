'use client'

import * as React from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { GaLogo } from '@/components/ui-v2'
import type { LegalLang } from '@/content/legal/privacy'
import './legalGa.css'

/**
 * LegalDocGa — public legal document (currently /privacy) rendered in the Galerie
 * homepage theme, with a VN / EN / DE language switcher. Wrap the page in `.ga-scope`
 * so the `--ga-*` tokens resolve (see galerie.css).
 *
 * The default language server-renders into the initial HTML, so the policy stays
 * reachable/crawlable without JS (these URLs are registered in App Store Connect);
 * the switcher only re-picks which pre-bundled language is shown.
 */

interface LegalDocGaProps {
  /** Per-language markdown, e.g. the generated `PRIVACY` constant. */
  docs: Record<LegalLang, string>
  /** Language shown first (server render). Defaults to Vietnamese, the site's primary language. */
  defaultLang?: LegalLang
}

const LANGS: { code: LegalLang; label: string; short: string }[] = [
  { code: 'vi', label: 'Tiếng Việt', short: 'VI' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'de', label: 'Deutsch', short: 'DE' },
]

const STORAGE_KEY = 'df-legal-lang'

function isLegalLang(v: unknown): v is LegalLang {
  return v === 'vi' || v === 'en' || v === 'de'
}

export function LegalDocGa({ docs, defaultLang = 'vi' }: LegalDocGaProps) {
  const [lang, setLang] = React.useState<LegalLang>(defaultLang)

  // Restore the visitor's last choice after hydration (client-only, avoids SSR mismatch).
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (isLegalLang(saved)) setLang(saved)
    } catch {
      // localStorage unavailable (private mode / SSR) — keep the default.
    }
  }, [])

  const select = (code: LegalLang) => {
    setLang(code)
    try {
      localStorage.setItem(STORAGE_KEY, code)
    } catch {
      // ignore persistence failures
    }
  }

  const markdown = docs[lang] ?? docs.vi ?? Object.values(docs)[0] ?? ''

  return (
    <main className="min-h-screen bg-ga-bg font-ga-ui text-ga-ink">
      {/* Header — mirrors the landing nav: brand left, controls right */}
      <header className="sticky top-0 z-50 border-b border-ga-border bg-ga-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-[68px] max-w-3xl items-center justify-between gap-4 px-5">
          <Link href="/" aria-label="myDeutschFlow" className="transition-opacity hover:opacity-80">
            <GaLogo size={30} />
          </Link>
          <div role="group" aria-label="Language" className="inline-flex border border-ga-border">
            {LANGS.map((l, i) => {
              const on = l.code === lang
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => select(l.code)}
                  aria-pressed={on}
                  lang={l.code}
                  className={`px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                    i ? 'border-l border-ga-border' : ''
                  } ${on ? 'bg-ga-ink text-ga-bg' : 'bg-ga-card text-ga-muted hover:text-ga-ink'}`}
                >
                  <span className="hidden sm:inline">{l.label}</span>
                  <span className="sm:hidden">{l.short}</span>
                </button>
              )
            })}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <article key={lang} lang={lang} className="ga-legal">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </article>
        <LegalFooterGa />
      </div>
    </main>
  )
}

function LegalFooterGa() {
  const links: [string, string][] = [
    ['Privacy', '/privacy'],
    ['Terms', '/terms'],
    ['Support', '/support'],
    ['Trang chủ', '/'],
  ]
  return (
    <footer className="mt-16 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ga-border pt-6 text-[13px] text-ga-muted">
      {links.map(([label, href], i) => (
        <React.Fragment key={href}>
          {i > 0 && <span className="text-ga-faint">·</span>}
          <Link href={href} className="underline underline-offset-2 transition-colors hover:text-ga-ink">
            {label}
          </Link>
        </React.Fragment>
      ))}
    </footer>
  )
}
