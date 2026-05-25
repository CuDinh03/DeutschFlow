// Gender visual mapping - single source of truth.
export const GENDER_COLORS = {
  DER: '#3b82f6',
  DIE: '#ef4444',
  DAS: '#22c55e',
  PLURAL: '#a855f7',
} as const

export type Gender = keyof typeof GENDER_COLORS
export type GenderCode = 'DER' | 'DIE' | 'DAS' | 'PLURAL'

const GENDER_BG_CLASS: Record<GenderCode, string> = {
  DER: 'bg-gender-der',
  DIE: 'bg-gender-die',
  DAS: 'bg-gender-das',
  PLURAL: 'bg-gender-plural',
}

export function normalizeGenderCode(raw?: string | null): GenderCode | null {
  const v = String(raw || '').trim().toUpperCase()
  if (v === 'DER' || v === 'DIE' || v === 'DAS' || v === 'PLURAL') return v
  return null
}

export function inferGenderFromGermanText(raw?: string | null): GenderCode | null {
  const token = String(raw || '').trim().toLowerCase()
  if (!token) return null
  if (token.startsWith('die ') && token.includes('(pl')) return 'PLURAL'
  if (token.startsWith('der ') || token === 'der') return 'DER'
  if (token.startsWith('die ') || token === 'die') return 'DIE'
  if (token.startsWith('das ') || token === 'das') return 'DAS'
  return null
}

export function genderBgClass(raw?: string | null): string {
  const code = normalizeGenderCode(raw)
  if (!code) return 'bg-muted'
  return GENDER_BG_CLASS[code]
}

export function genderPalette(raw?: string | null) {
  const code = normalizeGenderCode(raw)
  if (!code) {
    return { color: '#E2E8F0', shadow: '#CBD5E1', text: '#1A1A1A' }
  }
  const hex = GENDER_COLORS[code]
  return {
    color: hex,
    shadow: '#1e293b',
    text: '#FFFFFF',
  }
}

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type CefrLevel = typeof CEFR_LEVELS[number]
