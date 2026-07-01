// Password strength scoring — 1:1 port of the v2 auth mockup (na-auth.jsx
// pwStrength). Score one point each for length≥8, an uppercase letter, a digit,
// and a symbol; map to a 0–4 level with a Vietnamese label and a theme tone.

export type StrengthTone = 'danger' | 'orange' | 'accentText' | 'success'

export interface PasswordStrength {
  /** 0 (too short) … 4 (strong) — also the number of filled meter segments. */
  level: number
  label: string
  tone: StrengthTone
}

export function passwordStrength(pw: string): PasswordStrength {
  let s = 0
  if (pw.length >= 8) s++
  if (/[A-Z]/.test(pw)) s++
  if (/[0-9]/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++

  if (pw.length < 6) return { level: 0, label: 'Quá ngắn', tone: 'danger' }
  if (s <= 1) return { level: 1, label: 'Yếu', tone: 'danger' }
  if (s === 2) return { level: 2, label: 'Trung bình', tone: 'orange' }
  if (s === 3) return { level: 3, label: 'Khá', tone: 'accentText' }
  return { level: 4, label: 'Mạnh', tone: 'success' }
}
