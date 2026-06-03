// Semantic color tokens for light + dark.
// Brand identity = logo: gold #FFCD00 (primary accent) + red #DA291C (secondary
// brand accent for energy/emphasis — distinct from `danger`, which is error-only).
// No pure #000 / #fff — off-black and off-white preserve depth (taste-skill 8.B).

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
  // Brand accent (fill is yellow in both modes; foreground darkens on light for AA)
  accent: string
  accentSoft: string
  onAccent: string
  accentText: string
  // Secondary brand accent (logo red — energy/emphasis, NOT error semantics)
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
  // German article genders
  der: string
  die: string
  das: string
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

const ACCENT = '#FFCD00' // brand gold — matches logo/splash

export const darkColors: ThemeColors = {
  bg: '#0B0B0C',
  surface: '#1A1A1D',
  surfaceElevated: '#222227',
  surfaceSunken: '#0E0E10',
  border: '#2A2A2E',
  borderStrong: '#3A3A40',
  textPrimary: '#F4F4F6',
  textSecondary: '#A6A6AE',
  textMuted: '#6E6E78',
  textFaint: '#48484F',
  accent: ACCENT,
  accentSoft: 'rgba(255,205,0,0.15)',
  onAccent: '#1A1500',
  accentText: ACCENT,
  brand: '#E8392B', // logo red, lifted slightly for dark-bg legibility
  brandSoft: 'rgba(232,57,43,0.16)',
  onBrand: '#FFFFFF',
  success: '#2DC653',
  successSoft: 'rgba(45,198,83,0.16)',
  danger: '#E63946',
  dangerSoft: 'rgba(230,57,70,0.16)',
  info: '#3A86FF',
  infoSoft: 'rgba(58,134,255,0.16)',
  der: '#5B9BFF',
  die: '#FF5C6A',
  das: '#46D873',
  overlay: 'rgba(0,0,0,0.62)',
  skeletonBase: '#1E1E22',
  skeletonHighlight: '#2C2C32',
}

export const lightColors: ThemeColors = {
  bg: '#FAFAFB',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceSunken: '#F1F1F4',
  border: '#E6E6EA',
  borderStrong: '#D2D2D8',
  textPrimary: '#17171A',
  textSecondary: '#52525B',
  textMuted: '#8A8A93',
  textFaint: '#B6B6BE',
  accent: ACCENT,
  accentSoft: 'rgba(255,205,0,0.22)',
  onAccent: '#1A1500',
  accentText: '#9A7400', // deep amber: passes AA on light surfaces
  brand: '#DA291C', // logo red — passes AA on light surfaces
  brandSoft: 'rgba(218,41,28,0.12)',
  onBrand: '#FFFFFF',
  success: '#1B9E43',
  successSoft: 'rgba(27,158,67,0.14)',
  danger: '#D32536',
  dangerSoft: 'rgba(211,37,54,0.12)',
  info: '#2563EB',
  infoSoft: 'rgba(37,99,235,0.12)',
  der: '#2563EB',
  die: '#D32536',
  das: '#1B9E43',
  overlay: 'rgba(17,17,20,0.45)',
  skeletonBase: '#ECECEF',
  skeletonHighlight: '#F6F6F8',
}

const darkShadow: Theme['shadow'] = {
  card: { shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  lifted: { shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
}

const lightShadow: Theme['shadow'] = {
  card: { shadowColor: '#1A1A2E', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  lifted: { shadowColor: '#1A1A2E', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 9 },
}

export const darkTheme: Theme = { isDark: true, colors: darkColors, shadow: darkShadow, blurTint: 'dark' }
export const lightTheme: Theme = { isDark: false, colors: lightColors, shadow: lightShadow, blurTint: 'light' }

export const themeShadowStyle = (s: ShadowToken): ViewStyle => s
