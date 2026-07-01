// Semantic color tokens — v2 "Galerie" warm-paper (LIGHT-ONLY).
// Brand identity = logo: gold #FFCD00 + red #DA291C, carried over from v1.
// The design has no dark variant, so `darkTheme`/`darkColors` alias the light
// (warm-paper) values — the app renders warm-paper regardless of system scheme.
// Token KEYS are unchanged from v1 so every consumer keeps compiling.

import type { ViewStyle } from 'react-native'

export interface ShadowToken {
  shadowColor: string
  shadowOpacity: number
  shadowRadius: number
  shadowOffset: { width: number; height: number }
  elevation: number
}

export interface ThemeColors {
  // Surfaces (layered for depth)
  bg: string
  surface: string
  surfaceElevated: string
  surfaceSunken: string
  // Lines
  border: string
  borderStrong: string
  // Text
  textPrimary: string
  textSecondary: string
  textMuted: string
  textFaint: string
  // Brand accent (yellow square motif; foreground darkens for AA on warm paper)
  accent: string
  accentSoft: string
  onAccent: string
  accentText: string
  // Secondary brand accent (logo red — energy/emphasis)
  brand: string
  brandSoft: string
  onBrand: string
  // Semantic states
  success: string
  successSoft: string
  danger: string
  dangerSoft: string
  info: string
  infoSoft: string
  // Extended editorial hues (na-theme.jsx NA.violet/teal/orange) — teacher
  // avatars, secondary categories, and the password-strength "medium" tier.
  violet: string
  teal: string
  orange: string
  // German article genders
  der: string
  die: string
  das: string
  // Ink surface (editorial dark hero cards) + its foregrounds
  inkSurface: string
  onInk: string
  onInkMuted: string
  // Misc
  overlay: string
  skeletonBase: string
  skeletonHighlight: string
}

export interface Theme {
  isDark: boolean
  colors: ThemeColors
  shadow: { card: ShadowToken; lifted: ShadowToken }
  // Convenience for blur tint
  blurTint: 'dark' | 'light'
}

const YELLOW = '#FFCD00' // brand gold (yellow-square motif)
const GOLD = '#C79A00' // deep gold — passes AA on warm paper
const RED = '#DA291C' // logo red (also danger in v2)

// Warm-paper palette (na-theme.jsx → NA.*)
export const lightColors: ThemeColors = {
  bg: '#FBFAF7',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceSunken: '#F6F3EC',
  border: '#E7E3DA',
  borderStrong: '#D8D2C6',
  textPrimary: '#161513', // ink
  textSecondary: '#76716A', // muted
  textMuted: '#B3ADA5', // subtle
  textFaint: '#C9C4BC', // faint
  accent: YELLOW,
  accentSoft: 'rgba(255,205,0,0.16)',
  onAccent: '#161513', // ink reads on yellow
  accentText: GOLD,
  brand: RED,
  brandSoft: 'rgba(218,41,28,0.12)',
  onBrand: '#FFFFFF',
  success: '#1E9E61',
  successSoft: 'rgba(30,158,97,0.13)',
  danger: RED,
  dangerSoft: 'rgba(218,41,28,0.12)',
  info: '#2F6FC9',
  infoSoft: 'rgba(47,111,201,0.12)',
  violet: '#7C56C8',
  teal: '#11888A',
  orange: '#E07B39',
  der: '#2F6FC9', // blue
  die: '#DA291C', // red
  das: '#1E9E61', // green
  inkSurface: '#161513', // editorial dark hero card
  onInk: '#FBFAF7', // primary text on ink
  onInkMuted: '#A39E94', // secondary text on ink
  overlay: 'rgba(22,21,19,0.45)',
  skeletonBase: '#EFEBE2',
  skeletonHighlight: '#F7F4ED',
}

// Light-only: dark aliases the warm-paper palette.
export const darkColors: ThemeColors = lightColors

// Warm-paper leans on hairline borders; shadows stay subtle.
const paperShadow: Theme['shadow'] = {
  card: { shadowColor: '#161513', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  lifted: { shadowColor: '#161513', shadowOpacity: 0.1, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
}

export const lightTheme: Theme = { isDark: false, colors: lightColors, shadow: paperShadow, blurTint: 'light' }
// Light-only app: requesting "dark" still yields warm-paper.
export const darkTheme: Theme = lightTheme

export const themeShadowStyle = (s: ShadowToken): ViewStyle => s
