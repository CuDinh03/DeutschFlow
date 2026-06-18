'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { GaLogo } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Shared auth primitives for the Galerie 2.0 public surface (GaAuthShell / GaField
// / GoogleBtn / pwStrength) — ported 1:1 from proto-auth.jsx, retokenized to ga-*.
// Used by /v2/login and /v2/register. These are PUBLIC pages (no role shell):
// the shell renders its own header + centered card, just like the prototype.
// ─────────────────────────────────────────────────────────────────────────────

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Full-screen auth chrome: brand header + back-to-landing + centered content. */
export function GaAuthShell({
  children,
  wide = false,
  showBackToLanding = true,
}: {
  children: React.ReactNode
  wide?: boolean
  showBackToLanding?: boolean
}) {
  return (
    <div className="flex min-h-screen flex-col bg-ga-bg text-ga-ink">
      <header className="flex items-center justify-between border-b border-ga-line bg-ga-card px-10 py-6">
        <Link href="/" aria-label="myDeutschFlow" className="inline-flex">
          <GaLogo />
        </Link>
        {showBackToLanding && (
          <Link href="/" className="ga-ui text-[13.5px] text-ga-muted transition-colors hover:text-ga-ink">
            ← Trang chủ
          </Link>
        )}
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
}

/** Labelled input with focus ring, inline error/hint, and password reveal toggle. */
export function GaField({ label, type = 'text', placeholder = '', value, onChange, hint, error, required, autoComplete }: GaFieldProps) {
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
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          className="ga-ui block w-full rounded-ga bg-ga-card px-[15px] py-3 text-[15px] text-ga-ink outline-none transition-[border-color,box-shadow] duration-150"
          style={{ border: `1px solid ${borderColor}`, boxShadow: ring, paddingRight: isPw ? 42 : 15 }}
        />
        {isPw && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
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

/** "hoặc" rule between primary CTA and the (non-wired) Google button. */
export function AuthDivider() {
  return (
    <div className="mb-4 flex items-center gap-3.5">
      <div className="h-px flex-1 bg-ga-line" />
      <span className="ga-ui text-[10px] font-bold uppercase tracking-[0.1em] text-ga-muted">hoặc</span>
      <div className="h-px flex-1 bg-ga-line" />
    </div>
  )
}

/**
 * Google button — visual parity with the prototype. The backend has NO Google
 * OAuth endpoint (legacy /login has no social sign-in either), so this is an
 * honest "sắp ra mắt" toast rather than a fake sign-in (Option-1: don't fabricate).
 */
export function GoogleBtn() {
  return (
    <button
      type="button"
      onClick={() => toast('Đăng nhập với Google (sắp ra mắt)')}
      className="ga-ui flex w-full items-center justify-center gap-2.5 rounded-ga border border-ga-line bg-ga-card px-0 py-[13px] text-[14.5px] font-medium text-ga-ink transition-colors hover:bg-ga-surface"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      Tiếp tục với Google
    </button>
  )
}

export interface PwStrength {
  score: number
  label: string
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
  const map: Record<number, { label: string; color: string }> = {
    1: { label: 'Yếu', color: 'var(--ga-red)' },
    2: { label: 'Khá', color: 'var(--ga-orange)' },
    3: { label: 'Mạnh', color: 'var(--ga-green)' },
  }
  return { score: s, ...map[s] }
}
