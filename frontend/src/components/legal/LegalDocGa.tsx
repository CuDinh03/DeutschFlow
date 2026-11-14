'use client'

import * as React from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { LegalLang } from '@/content/legal/privacy'
import './legalGa.css'

/**
 * LegalDocGa — tài liệu pháp lý công khai (`/privacy`, `/terms`) hiển thị trên khung `PublicShell` v3.4
 * kèm thanh chọn ngôn ngữ tài liệu `VI / EN / DE` ngay đầu trang.
 *
 * Bản tiếng Việt được render sẵn từ server để các URL đăng ký trên App Store Connect đọc được không cần JS;
 * thanh chuyển ngôn ngữ chỉ đổi bản dịch markdown đã đóng gói sẵn.
 */

interface LegalDocGaProps {
  docs: Record<LegalLang, string>
  defaultLang?: LegalLang
}

const LANGS: { code: LegalLang; label: string; short: string }[] = [
  { code: 'vi', label: 'Tiếng Việt', short: 'VI' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'de', label: 'Deutsch', short: 'DE' },
]

const STORAGE_KEY = 'df-legal-lang'

const DOC_META_LABELS: Record<
  LegalLang,
  { langPrompt: string; privacy: string; terms: string; support: string }
> = {
  vi: {
    langPrompt: 'Ngôn ngữ văn bản',
    privacy: 'Chính sách bảo mật',
    terms: 'Điều khoản sử dụng',
    support: 'Hỗ trợ',
  },
  en: {
    langPrompt: 'Document language',
    privacy: 'Privacy Policy',
    terms: 'Terms of Use',
    support: 'Support',
  },
  de: {
    langPrompt: 'Dokumentsprache',
    privacy: 'Datenschutz',
    terms: 'Nutzungsbedingungen',
    support: 'Support',
  },
}

function isLegalLang(v: unknown): v is LegalLang {
  return v === 'vi' || v === 'en' || v === 'de'
}

export function LegalDocGa({ docs, defaultLang = 'vi' }: LegalDocGaProps) {
  const [lang, setLang] = React.useState<LegalLang>(defaultLang)

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (isLegalLang(saved)) setLang(saved)
    } catch {
      // localStorage unavailable — keep default language.
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
  const labels = DOC_META_LABELS[lang] ?? DOC_META_LABELS.vi

  return (
    <div className="mx-auto max-w-[880px] px-5 py-10 sm:px-8 sm:py-14">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-ga-xl border border-ga-border bg-ga-card px-4 py-3 shadow-ga-sm sm:px-5">
        <span className="text-ga-caption font-medium text-ga-muted">{labels.langPrompt}</span>
        <div role="group" aria-label="Language" className="inline-flex rounded-ga-pill border border-ga-border bg-ga-bg p-1">
          {LANGS.map((l) => {
            const on = l.code === lang
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => select(l.code)}
                aria-pressed={on}
                lang={l.code}
                className={`min-h-9 rounded-ga-pill px-3.5 py-1 text-ga-caption font-semibold transition-colors ${
                  on ? 'bg-ga-ink text-ga-bg shadow-ga-sm' : 'text-ga-muted hover:text-ga-ink'
                }`}
              >
                <span className="hidden sm:inline">{l.label}</span>
                <span className="sm:hidden">{l.short}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-ga-xl border border-ga-border bg-ga-card p-6 shadow-ga-sm sm:p-10">
        <article key={lang} lang={lang} className="ga-legal">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </article>

        <nav
          aria-label="Tài liệu pháp lý liên quan"
          className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ga-border pt-5 text-ga-small text-ga-muted"
        >
          <Link href="/privacy/" className="font-medium text-ga-navy underline decoration-ga-yellow decoration-2 underline-offset-4 hover:text-ga-ink">
            {labels.privacy}
          </Link>
          <span aria-hidden className="text-ga-faint">·</span>
          <Link href="/terms/" className="font-medium text-ga-navy underline decoration-ga-yellow decoration-2 underline-offset-4 hover:text-ga-ink">
            {labels.terms}
          </Link>
          <span aria-hidden className="text-ga-faint">·</span>
          <Link href="/support/" className="font-medium text-ga-navy underline decoration-ga-yellow decoration-2 underline-offset-4 hover:text-ga-ink">
            {labels.support}
          </Link>
        </nav>
      </div>
    </div>
  )
}
