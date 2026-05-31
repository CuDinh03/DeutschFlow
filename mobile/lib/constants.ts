export const API_BASE_URL = 'https://api.mydeutschflow.com/api'

// Design tokens — mirrors DesignTokens.swift + web CSS variables
export const Colors = {
  bg: '#0D0D0D',
  card: '#1A1A1A',
  cardBorder: '#2A2A2A',
  yellow: '#F5C842',
  red: '#E63946',
  blue: '#3A86FF',
  green: '#2DC653',
  muted: '#64748B',
  white: '#FFFFFF',
  // Gender colors
  der: '#3A86FF',
  die: '#E63946',
  das: '#2DC653',
  // Subscription tiers
  pro: '#F5C842',
  ultra: '#A855F7',
} as const

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
} as const

export const CEFR_BANDS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type CefrBand = (typeof CEFR_BANDS)[number]

export const PLAN_TIERS = ['FREE', 'PRO', 'ULTRA'] as const
export type PlanTier = (typeof PLAN_TIERS)[number]
