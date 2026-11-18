// Semantic color tokens — nhận diện v3.4 (18/11/2026), LIGHT-ONLY, giống web
// (docs/HE_THONG_THIET_KE_GIAO_DIEN_BEN_TRONG_V3.md): giấy ấm #FAF9F6, mực #171615,
// vàng #FFC900, đỏ #E3261D (chữ "Flow" luôn đỏ), xanh hải quân #23406E (der, focus),
// xanh lá #169B5E (das, đạt). Không còn chữ mờ #B3ADA5 (2,1:1) và chữ vàng #C79A00
// (2,5:1): chữ phụ dùng #6E6A63 (≥ 4,5:1 trên giấy), chữ trên nền vàng dùng mực.
// darkTheme/darkColors vẫn trỏ về bảng sáng. KHOÁ token giữ nguyên để mọi màn biên dịch.

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

const YELLOW = '#FFC900' // vàng thương hiệu v3.4
const RED = '#E3261D' // đỏ logo, die, nguy hiểm
const INK = '#171615'
const NAVY = '#23406E' // der, thông tin, viền focus
const GREEN = '#169B5E' // das, đạt

export const lightColors: ThemeColors = {
  bg: '#FAF9F6',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceSunken: '#F3EFE8',
  border: 'rgba(23,22,21,0.09)',
  borderStrong: 'rgba(23,22,21,0.18)',
  textPrimary: INK,
  textSecondary: '#6E6A63',
  // Bỏ chữ mờ không đạt tương phản: textMuted = chữ phụ. textFaint chỉ cho chi tiết trang trí.
  textMuted: '#6E6A63',
  textFaint: '#8A847B',
  accent: YELLOW,
  accentSoft: 'rgba(255,201,0,0.22)',
  onAccent: INK,
  // Chữ "nhấn vàng" cũ (#C79A00) không đạt 4,5:1 ⇒ dùng mực; điểm nhấn vàng nằm ở nền/viền.
  accentText: INK,
  brand: RED,
  brandSoft: 'rgba(227,38,29,0.10)',
  onBrand: '#FFFFFF',
  success: GREEN,
  successSoft: 'rgba(22,155,94,0.12)',
  danger: RED,
  dangerSoft: 'rgba(227,38,29,0.10)',
  info: NAVY,
  infoSoft: 'rgba(35,64,110,0.10)',
  violet: '#7C56C8',
  teal: '#11888A',
  orange: '#C26A1B',
  der: NAVY,
  die: RED,
  das: GREEN,
  inkSurface: INK,
  onInk: '#FAF9F6',
  onInkMuted: 'rgba(255,255,255,0.68)',
  overlay: 'rgba(23,22,21,0.45)',
  skeletonBase: '#EFEAE1',
  skeletonHighlight: '#F7F4EE',
}

// Light-only: dark aliases the warm-paper palette.
export const darkColors: ThemeColors = lightColors

// Bóng ấm v3.4 (--sh-sm / --sh-md của web).
const paperShadow: Theme['shadow'] = {
  card: { shadowColor: INK, shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  lifted: { shadowColor: INK, shadowOpacity: 0.1, shadowRadius: 32, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
}

export const lightTheme: Theme = { isDark: false, colors: lightColors, shadow: paperShadow, blurTint: 'light' }
// Light-only app: requesting "dark" still yields warm-paper.
export const darkTheme: Theme = lightTheme

export const themeShadowStyle = (s: ShadowToken): ViewStyle => s
