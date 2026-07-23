'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { getAccessToken } from '@/lib/authSession'

const LOCALES: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'vi', label: 'VI' },
  { code: 'en', label: 'EN' },
  { code: 'de', label: 'DE' },
]

/**
 * LanguageToggle — segmented VI/EN/DE switcher in the top bar (design parity).
 * Mirrors the existing components/ui/LanguageSwitcher conventions so all surfaces agree:
 * sets the `locale` cookie (now read server-side in src/i18n/request.ts), persists to the profile
 * via PATCH /auth/me/locale when signed in, then refreshes the server tree. Screens with hard-coded
 * Vietnamese strings stay Vietnamese until those strings are extracted to messages/*.json.
 */
export function LanguageToggle() {
  const t = useTranslations('v2.shell')
  const active = useLocale()
  const router = useRouter()
  const [pending, setPending] = React.useState<string | null>(null)

  async function change(code: string) {
    if (code === active || pending) return
    setPending(code)
    try {
      document.cookie = `locale=${code};path=/;max-age=31536000;SameSite=Lax`
      if (getAccessToken()) {
        await api.patch('/auth/me/locale', { locale: code })
      }
      router.refresh()
    } catch {
      // cookie is already set; the UI still updates on refresh.
      router.refresh()
    } finally {
      setPending(null)
    }
  }

  return (
    <div
      className="flex items-center rounded-ga border border-ga-line p-0.5"
      role="group"
      aria-label={t('languageAria')}
    >
      {LOCALES.map((l) => {
        const isActive = l.code === active
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => change(l.code)}
            aria-pressed={isActive}
            disabled={pending !== null}
            className={
              'rounded-[6px] px-2 py-1 text-[11px] font-semibold transition-colors ' +
              (isActive ? 'bg-ga-accent-soft text-ga-accent' : 'text-ga-subtle hover:text-ga-ink')
            }
          >
            {l.label}
          </button>
        )
      })}
    </div>
  )
}
