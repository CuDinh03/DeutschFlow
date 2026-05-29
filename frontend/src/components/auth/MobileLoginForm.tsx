'use client'

import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  form: { email: string; password: string }
  error: string
  fieldErrors: Record<string, string>
  loading: boolean
  onChange: (field: 'email' | 'password', value: string) => void
  onSubmit: (e: React.FormEvent) => void
}

// ─── Shared style tokens ──────────────────────────────────────────────────────

const BG     = '#0A0A0F'
const YELLOW = '#FFCD00'
const BLACK  = '#121212'
const RED    = '#DA291C'   // errors / links only

const inputBase: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 14,          // matches iOS DF.Radius.md = 14
  padding: '15px 16px',
  color: '#fff',
  fontSize: 16,
  outline: 'none',
}

// ─── D-logo mark (inline, no external dep) ───────────────────────────────────

function DLogoMark() {
  return (
    <svg width={52} height={52} viewBox="0 0 100 100" fill="none">
      <path
        d="M 20 18 L 20 82 L 52 82 L 74 62 L 74 38 L 52 18 Z"
        fill="none"
        stroke="#fff"
        strokeWidth={6}
        strokeLinejoin="miter"
      />
      <polygon points="52,38 74,50 52,62" fill="#DA291C" />
      <rect x={24} y={45} width={9} height={9} fill="#FFCD00" />
    </svg>
  )
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label,
  type,
  value,
  placeholder,
  error,
  autoComplete,
  onChange,
}: {
  label: string
  type: string
  value: string
  placeholder: string
  error?: string
  autoComplete?: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={e => onChange(e.target.value)}
        style={{
          ...inputBase,
          borderColor: error ? RED : 'rgba(255,255,255,0.12)',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = error ? RED : 'rgba(255,205,0,0.6)' }}
        onBlur={e => { e.currentTarget.style.borderColor = error ? RED : 'rgba(255,255,255,0.12)' }}
      />
      {error && (
        <span style={{ fontSize: 12, color: RED }}>{error}</span>
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MobileLoginForm({ form, error, fieldErrors, loading, onChange, onSubmit }: Props) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: BG,
        display: 'flex',
        flexDirection: 'column',
        padding: 'env(safe-area-inset-top, 16px) 28px env(safe-area-inset-bottom, 32px)',
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 56, paddingBottom: 40 }}>
        <DLogoMark />
      </div>

      {/* Headline */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff', margin: 0 }}>Đăng nhập</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>
          Chào mừng trở lại!
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          background: 'rgba(218,41,28,0.12)',
          border: `1px solid rgba(218,41,28,0.35)`,
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 20,
          fontSize: 14,
          color: '#ff6b5b',
        }}>
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        <Field
          label="Email"
          type="email"
          value={form.email}
          placeholder="email@example.com"
          error={fieldErrors.email}
          autoComplete="email"
          onChange={v => onChange('email', v)}
        />
        <Field
          label="Mật khẩu"
          type="password"
          value={form.password}
          placeholder="••••••••"
          error={fieldErrors.password}
          autoComplete="current-password"
          onChange={v => onChange('password', v)}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 8,
            width: '100%',
            padding: '18px 0',
            background: loading ? 'rgba(255,205,0,0.5)' : YELLOW,
            border: 'none',
            borderRadius: 14,
            color: loading ? 'rgba(18,18,18,0.55)' : BLACK,
            fontSize: 17,
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: loading ? 'none' : '0 6px 16px rgba(255,205,0,0.35)',
            transition: 'opacity 0.2s ease, box-shadow 0.2s ease',
          }}
        >
          {loading ? (
            <>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                <circle cx={12} cy={12} r={10} stroke="rgba(18,18,18,0.25)" strokeWidth={4} />
                <path d="M4 12a8 8 0 018-8" stroke={BLACK} strokeWidth={4} strokeLinecap="round" />
              </svg>
              Đang đăng nhập...
            </>
          ) : 'Đăng nhập'}
        </button>

        <p style={{ textAlign: 'center', fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 12 }}>
          Chưa có tài khoản?{' '}
          <Link href="/register" style={{ color: RED, fontWeight: 600, textDecoration: 'none' }}>
            Tạo tài khoản
          </Link>
        </p>
      </form>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
