'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { GaLogo } from '@/components/ui-v2'
// Imported from its module (not the ui-v2 barrel): the barrel does not re-export it today.
import { LanguageToggle } from '@/components/ui-v2/LanguageToggle'

// ─────────────────────────────────────────────────────────────────────────────
// Shared auth primitives for the Galerie 2.0 public surface (GaAuthShell / GaField
// / pwStrength) — used by /v2/login, /v2/register and /v2/forgot-password. These
// are PUBLIC pages (no role shell): the shell renders its own header + centered card.
//
// All copy resolves through next-intl ('v2.auth.…', messages/v2/auth.<locale>.json).
// It used to be hard-coded Vietnamese, which meant retiring the legacy /login — the
// only trilingual auth surface — would have silently dropped EN/DE users to Vietnamese.
//
// REMOVED: the Google sign-in button + its "hoặc" divider. The backend has NO OAuth
// endpoint, so the button could only ever fire a "coming soon" toast — a promise the
// product cannot keep. A button that does nothing is worse than no button.
// ─────────────────────────────────────────────────────────────────────────────

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Full-screen auth chrome: brand header + language toggle + back-to-landing + centered content. */
export function GaAuthShell({
  children,
  wide = false,
  showBackToLanding = true,
}: {
  children: React.ReactNode
  wide?: boolean
  showBackToLanding?: boolean
}) {
  const t = useTranslations('v2.auth')
  return (
    <div className="flex min-h-screen flex-col bg-ga-bg text-ga-ink">
      <header className="flex items-center justify-between border-b border-ga-line bg-ga-card px-10 py-6">
        {/* Brand name — not translated on purpose. */}
        <Link href="/" aria-label="DeutschFlow" className="inline-flex">
          <GaLogo />
        </Link>
        <div className="flex items-center gap-4">
          {/* The locale cookie is otherwise only written at login (from user.locale) or by the
              in-app toggle, so a first-time EN/DE visitor would be stuck on Vietnamese with no way
              out. The legacy /login carried a LanguageSwitcher for exactly this reason. */}
          <LanguageToggle />
          {showBackToLanding && (
            <Link href="/" className="ga-ui text-[13.5px] text-ga-muted transition-colors hover:text-ga-ink">
              {t('shell.backHome')}
            </Link>
          )}
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full" style={{ maxWidth: wide ? 700 : 440 }}>
          {children}
        </div>
      </main>
    </div>
  )
}

interface GaFieldProps {
  label: string
  type?: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
  hint?: string
  error?: string
  required?: boolean
  autoComplete?: string
  inputMode?: 'text' | 'numeric' | 'email' | 'tel'
  maxLength?: number
}

/** Labelled input with focus ring, inline error/hint, and password reveal toggle. */
export function GaField({
  label,
  type = 'text',
  placeholder = '',
  value,
  onChange,
  hint,
  error,
  required,
  autoComplete,
  inputMode,
  maxLength,
}: GaFieldProps) {
  const t = useTranslations('v2.auth')
  const [focus, setFocus] = useState(false)
  const [show, setShow] = useState(false)
  const isPw = type === 'password'
  const inputType = isPw && show ? 'text' : type
  const borderColor = error ? 'var(--ga-red)' : focus ? 'var(--ga-ink)' : 'var(--ga-line)'
  const ring = error
    ? '0 0 0 3px color-mix(in srgb, var(--ga-red) 12%, transparent)'
    : focus
      ? '0 0 0 3px color-mix(in srgb, var(--ga-ink) 8%, transparent)'
      : 'none'
  return (
    <div className="mb-4">
      <label className="ga-ui mb-[7px] block text-[13px] font-semibold text-ga-ink">
        {label}
        {required && <span className="text-ga-red"> *</span>}
      </label>
      <div className="relative">
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          className="ga-ui block w-full rounded-ga bg-ga-card px-[15px] py-3 text-[15px] text-ga-ink outline-none transition-[border-color,box-shadow] duration-150"
          style={{ border: `1px solid ${borderColor}`, boxShadow: ring, paddingRight: isPw ? 42 : 15 }}
        />
        {isPw && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? t('field.hidePassword') : t('field.showPassword')}
            className="absolute right-1.5 top-1/2 grid h-[30px] w-[30px] -translate-y-1/2 place-items-center text-ga-muted transition-colors hover:text-ga-ink"
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error ? (
        <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-ga-red">
          <AlertCircle size={14} /> {error}
        </div>
      ) : (
        hint && <div className="mt-[5px] text-[12px] text-ga-muted">{hint}</div>
      )}
    </div>
  )
}

/** Inline error banner for whole-form failures (wrong credentials, etc.). */
export function AuthErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-5 flex items-start gap-2.5 rounded-ga px-4 py-3.5"
      style={{ background: 'var(--ga-red-soft)', border: '1px solid color-mix(in srgb, var(--ga-red) 35%, transparent)' }}
      role="alert"
    >
      <AlertCircle size={18} className="mt-0.5 shrink-0 text-ga-red" />
      <div className="text-[13.5px] leading-relaxed text-ga-ink">{children}</div>
    </div>
  )
}

export interface PwStrength {
  score: number
  /** i18n key under `v2.auth.strength` — the caller translates it (this fn is not a component). */
  labelKey: 'weak' | 'fair' | 'strong'
  color: string
}

/** Password strength meter (length / case-mix / digit / symbol) → 1-3 + color token. */
export function pwStrength(pw: string): PwStrength | null {
  if (!pw) return null
  let s = 0
  if (pw.length >= 8) s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  s = Math.max(1, Math.min(3, s))
  const map: Record<number, { labelKey: PwStrength['labelKey']; color: string }> = {
    1: { labelKey: 'weak', color: 'var(--ga-red)' },
    2: { labelKey: 'fair', color: 'var(--ga-orange)' },
    3: { labelKey: 'strong', color: 'var(--ga-green)' },
  }
  return { score: s, ...map[s] }
}
