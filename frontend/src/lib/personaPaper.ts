/**
 * Persona accents on Galerie warm paper.
 *
 * `PERSONA_TOKENS.accent` was authored for the old dark speaking surface (#080818),
 * where a bright #EAB308 or #00BFA5 reads fine. On warm paper the same hue drops to
 * ~1.7:1 and can no longer carry text. The speaking screens therefore use:
 *   - `personaInk()`  for anything that is READ (name role, chip label, section caption)
 *   - the raw accent   for anything that is only SEEN (border, check badge, progress fill)
 *   - `personaSoft()`  for tinted fills behind either of the two
 *
 * Darkening keeps the hue (all three channels scale together), so a teal persona stays
 * teal — it just gets deep enough to satisfy WCAG AA (4.5:1) for body-sized text.
 */

/** Warm-paper page background (`--ga-bg`) — the darker of the two Galerie surfaces. */
export const PAPER_BG = '#FBFAF7'

/** Galerie ink (`--ga-ink`) — fallback whenever an accent cannot be parsed. */
const GA_INK = '#161513'

const AA_TEXT = 4.5
/** Each pass removes 6% of the channel value; 40 passes take any color to near-black. */
const DARKEN_STEP = 0.94
const MAX_PASSES = 40

interface Rgb {
  r: number
  g: number
  b: number
}

function parseHex(value: string): Rgb | null {
  const hex = value.trim().replace(/^#/, '')
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

function toHex({ r, g, b }: Rgb): string {
  const pair = (n: number) => Math.round(n).toString(16).padStart(2, '0').toUpperCase()
  return `#${pair(r)}${pair(g)}${pair(b)}`
}

/** WCAG 2.1 relative luminance. */
function luminance({ r, g, b }: Rgb): number {
  const channel = (raw: number) => {
    const c = raw / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio between two hex colors (1 = identical, 21 = black on white). */
export function contrastRatio(a: string, b: string): number {
  const rgbA = parseHex(a) ?? parseHex(GA_INK)!
  const rgbB = parseHex(b) ?? parseHex(GA_INK)!
  const lumA = luminance(rgbA)
  const lumB = luminance(rgbB)
  const lighter = Math.max(lumA, lumB)
  const darker = Math.min(lumA, lumB)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Darkens a persona accent just far enough to clear AA against warm paper.
 * Accents that already pass are returned untouched.
 */
export function personaInk(accent: string, background: string = PAPER_BG): string {
  const rgb = parseHex(accent)
  if (!rgb) return GA_INK

  let current = rgb
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    if (contrastRatio(toHex(current), background) >= AA_TEXT) break
    current = {
      r: current.r * DARKEN_STEP,
      g: current.g * DARKEN_STEP,
      b: current.b * DARKEN_STEP,
    }
  }
  return toHex(current)
}

/** Tinted fill derived from an accent — replaces the old per-persona `bg`/`tagBg` tokens. */
export function personaSoft(accent: string, alpha: number): string {
  const { r, g, b } = parseHex(accent) ?? parseHex(GA_INK)!
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`
}
