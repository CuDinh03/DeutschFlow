'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Eye, EyeOff, AlertCircle, ArrowUpRight } from 'lucide-react'
import { GaLogo } from '@/components/ui-v2'
import { GaAppIconMark } from '@/components/ui-v2/GaLogo'
// Imported from its module (not the ui-v2 barrel): the barrel does not re-export it today.
import { LanguageToggle } from '@/components/ui-v2/LanguageToggle'
import { APP_STORE_URL } from '@/components/landing-v2/links'

// ─────────────────────────────────────────────────────────────────────────────
// Shared auth primitives for the Warm Modern German EdTech v3.4 public surface
// (GaAuthShell / GaField / GaOtpField / pwStrength) — used by /v2/login,
// /v2/register, /v2/verify-email and /v2/forgot-password.
//
// Scoped with `.ga-scope.ga-public` so post-login screens are untouched.
// All copy resolves through next-intl ('v2.auth.…', messages/v2/auth.<locale>.json).
// ─────────────────────────────────────────────────────────────────────────────

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Full-screen auth chrome: brand header + language toggle + back-to-landing + centered warm paper card. */
export function GaAuthShell({
  children,
  wide = false,
  showBackToLanding = true,
  showAppStoreFooter = false,
}: {
  children: React.ReactNode
  wide?: boolean
  showBackToLanding?: boolean
  showAppStoreFooter?: boolean
}) {
  const t = useTranslations('v2.auth')
  return (
    <div className="ga-scope ga-public relative flex min-h-screen flex-col overflow-x-clip bg-ga-bg font-ga-ui text-ga-ink">
      {/* Hào quang giấy kem ấm rất nhẹ phía trên biểu mẫu */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-80"
        style={{
          background:
            'radial-gradient(ellipse 70% 100% at 50% 0%, rgba(255, 201, 0, 0.14), rgba(250, 249, 246, 0) 75%)',
        }}
      />

      <header
        className="relative z-10 flex items-center justify-between gap-3 border-b border-ga-border px-4 py-4 backdrop-blur-md sm:px-6 lg:px-10 lg:py-5"
        style={{ backgroundColor: 'color-mix(in srgb, var(--ga-card) 88%, transparent)' }}
      >
        {/* Một phần tử GaLogo duy nhất co cỡ thật qua --ga-logo-size: vừa khít từ 320px/390px tới Desktop, không lặp text DOM. */}
        <Link
          href="/"
          aria-label="myDeutschFlow"
          className="inline-flex min-w-0 shrink-0 transition-opacity [--ga-logo-size:25px] hover:opacity-85 sm:[--ga-logo-size:32px]"
        >
          <GaLogo />
        </Link>
        <div className="flex shrink-0 items-center gap-2 lg:gap-4">
          <LanguageToggle />
          {showBackToLanding && (
            <Link
              href="/"
              className="ga-ui hidden min-h-11 items-center whitespace-nowrap text-ga-small font-medium text-ga-muted transition-colors hover:text-ga-ink sm:inline-flex lg:min-h-0"
            >
              {t('shell.backHome')}
            </Link>
          )}
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-7 sm:px-6 sm:py-12">
        <div className="w-full" style={{ maxWidth: wide ? 700 : 456 }}>
          <div className="rounded-ga-lg border border-ga-border bg-ga-card p-6 shadow-ga-md sm:p-8">
            {children}
          </div>

          {showAppStoreFooter && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-ga-md border border-ga-border bg-ga-surface-2 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <GaAppIconMark size={30} className="rounded-ga-touch" />
                <span className="text-ga-caption font-medium text-ga-ink-2">{t('shell.iosPrompt')}</span>
              </div>
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-9 items-center gap-1 rounded-ga-pill bg-ga-ink px-3 py-1.5 text-ga-caption font-semibold text-white transition-opacity hover:opacity-90"
              >
                {t('shell.iosCta')}
                <ArrowUpRight size={13} aria-hidden />
                <span className="sr-only"> {t('shell.newTab')}</span>
              </a>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

interface GaFieldProps {
  id?: string
  name?: string
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
  id,
  name,
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
  const generatedId = useId().replace(/:/g, '')
  const fieldId = id ?? `ga-field-${name ?? generatedId}`
  const messageId = hint || error ? `${fieldId}-message` : undefined
  const [focus, setFocus] = useState(false)
  const [show, setShow] = useState(false)
  const isPw = type === 'password'
  const inputType = isPw && show ? 'text' : type
  const borderColor = error ? 'var(--ga-red)' : focus ? 'var(--ga-ink)' : 'var(--ga-border-strong)'
  const ring = error
    ? '0 0 0 3px color-mix(in srgb, var(--ga-red) 14%, transparent)'
    : focus
      ? '0 0 0 3px rgba(255, 201, 0, 0.30)'
      : 'none'
  return (
    <div className="mb-4">
      <label htmlFor={fieldId} className="ga-ui mb-1.5 block text-ga-small font-semibold text-ga-ink">
        {label}
        {required && (
          <span aria-hidden="true" className="text-ga-red">
            {' '}
            *
          </span>
        )}
      </label>
      <div className="relative">
        <input
          id={fieldId}
          name={name}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={messageId}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          className="ga-ui block min-w-0 w-full rounded-ga-sm bg-ga-card px-3.5 py-3 text-ga-body-lg text-ga-ink outline-none transition-[border-color,box-shadow] duration-150"
          style={{ border: `1.5px solid ${borderColor}`, boxShadow: ring, paddingRight: isPw ? 50 : 15 }}
        />
        {isPw && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? t('field.hidePassword') : t('field.showPassword')}
            aria-controls={fieldId}
            className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-ga-pill text-ga-muted transition-colors hover:text-ga-ink lg:right-1.5 lg:h-9 lg:w-9"
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error ? (
        <div id={messageId} role="alert" className="mt-1.5 flex items-center gap-1.5 text-ga-caption text-ga-red">
          <AlertCircle size={14} /> {error}
        </div>
      ) : (
        hint && (
          <div id={messageId} className="mt-1.5 text-ga-caption text-ga-muted">
            {hint}
          </div>
        )
      )}
    </div>
  )
}

/**
 * Ô nhập mã 6 số chống tràn viền tuyệt đối (v3.4 — `repeat(6, minmax(0, 1fr))` + `min-width: 0`).
 *
 * Bên dưới là MỘT `<input>` thật trong suốt phủ lên 6 ô `.ga-otp-cell`: hỗ trợ dán chuỗi có khoảng trắng
 * ("482 913" -> "482913"), gợi ý mã iOS/Android (`autocomplete="one-time-code"`) và trình đọc màn hình.
 */
export function GaOtpField({
  name = 'code',
  label,
  value,
  onChange,
  onComplete,
  error,
  length = 6,
  autoFocus = false,
  disabled = false,
}: {
  name?: string
  label: string
  value: string
  onChange: (digits: string) => void
  onComplete?: (digits: string) => void
  error?: string
  length?: number
  autoFocus?: boolean
  disabled?: boolean
}) {
  const fieldId = `ga-otp-${name}`
  const messageId = error ? `${fieldId}-message` : undefined
  const [focus, setFocus] = useState(false)
  const active = Math.min(value.length, length - 1)
  return (
    <div className="mb-6 min-w-0">
      <label htmlFor={fieldId} className="ga-ui mb-2.5 block text-center text-ga-small font-semibold text-ga-ink">
        {label}
      </label>
      <div className="relative mx-auto w-full min-w-0">
        <input
          id={fieldId}
          name={name}
          value={value}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, length)
            onChange(digits)
            if (digits.length === length) onComplete?.(digits)
          }}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          // KHÔNG đặt maxLength: trình duyệt cắt chuỗi DÁN trước khi onChange lọc ⇒ „482 913" mất số cuối.
          autoFocus={autoFocus}
          disabled={disabled}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={messageId}
          // 16px: chặn iOS tự phóng to trang khi focus ô nhập. min-w-0 + p-0 chống tràn chiều rộng mặc định size="20".
          style={{ fontSize: 16, caretColor: 'transparent' }}
          className="absolute inset-0 z-10 h-full min-w-0 w-full cursor-text bg-transparent p-0 text-transparent opacity-0 outline-none disabled:cursor-not-allowed"
        />
        <div
          aria-hidden="true"
          className="ga-otp-grid"
          style={length !== 6 ? { gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` } : undefined}
        >
          {Array.from({ length }, (_, i) => {
            const ch = value[i]
            const isActive = focus && i === active && value.length < length
            return (
              <div
                key={i}
                data-slot="otp-cell"
                data-active={isActive ? 'true' : undefined}
                data-filled={ch ? 'true' : undefined}
                data-error={error ? 'true' : undefined}
                className="ga-otp-cell ga-ui flex items-center justify-center text-ga-h1-m font-bold tabular-nums text-ga-ink sm:text-ga-h1"
                style={{ opacity: disabled ? 0.6 : 1 }}
              >
                {ch ?? (isActive ? <span className="h-6 w-0.5 animate-pulse bg-ga-ink" /> : null)}
              </div>
            )
          })}
        </div>
      </div>
      {error && (
        <div id={messageId} role="alert" className="mt-2.5 flex items-center justify-center gap-1.5 text-ga-caption text-ga-red">
          <AlertCircle size={14} /> {error}
        </div>
      )}
    </div>
  )
}

/** "0:42" — đếm ngược gửi lại mã. */
export function fmtCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Địa chỉ gửi thư mã (mặc định `app.mail.from` của backend) — nêu ra để người dùng tìm thư/lọc spam. */
export const MAIL_SENDER = 'support@mydeutschflow.com'

/** Inline error banner for whole-form failures (wrong credentials, etc.). */
export function AuthErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-5 flex items-start gap-2.5 rounded-ga-sm px-4 py-3.5"
      style={{
        background: 'var(--ga-red-soft)',
        border: '1px solid color-mix(in srgb, var(--ga-red) 35%, transparent)',
      }}
      role="alert"
    >
      <AlertCircle size={18} className="mt-0.5 shrink-0 text-ga-red" />
      <div className="text-ga-small leading-relaxed text-ga-ink">{children}</div>
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
