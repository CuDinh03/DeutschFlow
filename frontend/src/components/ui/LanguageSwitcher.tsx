'use client'

import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import api from '@/lib/api'
import { getAccessToken } from '@/lib/authSession'
import { Globe, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

const LOCALES = ['vi', 'en', 'de'] as const
const LOCALE_LABEL: Record<(typeof LOCALES)[number], string> = {
  vi: 'VI',
  en: 'EN',
  de: 'DE',
}

export default function LanguageSwitcher() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('nav')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const onChange = useCallback(
    async (next: string) => {
      if (!LOCALES.includes(next as (typeof LOCALES)[number]) || next === locale) return
      setBusy(true)
      try {
        document.cookie = `locale=${next};path=/;max-age=31536000;SameSite=Lax`
        if (getAccessToken()) {
          await api.patch('/auth/me/locale', { locale: next })
        }
        router.refresh()
      } catch {
        // cookie still set; UI language updates on refresh
        router.refresh()
      } finally {
        setBusy(false)
        setOpen(false)
      }
    },
    [locale, router]
  )

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="h-10 w-10 inline-flex items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm hover:bg-muted/60 transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('language')}
        title={t('language')}
        disabled={busy}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-44 rounded-xl border border-border bg-card p-1.5 shadow-lg z-[80]">
          <p className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">{t('language')}</p>
          {LOCALES.map((code) => {
            const active = locale === code
            return (
              <button
                key={code}
                type="button"
                onClick={() => onChange(code)}
                disabled={busy}
                className={`w-full text-left rounded-lg px-2 py-2 text-sm transition-colors flex items-center justify-between ${
                  active ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted text-foreground'
                }`}
              >
                <span>{t(code)}</span>
                <span className="text-[11px] text-muted-foreground">{LOCALE_LABEL[code]}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
