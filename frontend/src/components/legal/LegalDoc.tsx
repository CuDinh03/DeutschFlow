import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Renders a legal markdown document (privacy / terms) as a public, self-contained page.
 * Server-rendered (no 'use client') so the pages are static and reachable without JS —
 * these URLs are registered in App Store Connect. Styling comes from the `.legal-doc`
 * scope in globals.css (no @tailwindcss/typography plugin in this project).
 */
export function LegalDoc({ markdown }: { markdown: string }) {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-5 py-12">
        <article className="legal-doc">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </article>
        <LegalFooter />
      </div>
    </main>
  )
}

export function LegalFooter() {
  return (
    <footer className="mt-14 border-t border-slate-200 pt-6 text-sm text-slate-500">
      <a className="underline hover:text-slate-700" href="/privacy">Privacy</a>
      {' · '}
      <a className="underline hover:text-slate-700" href="/terms">Terms</a>
      {' · '}
      <a className="underline hover:text-slate-700" href="/support">Support</a>
    </footer>
  )
}
