// Gender color mapping — single source of truth cho toàn bộ frontend
export const GENDER_COLORS = {
  DER:    '#3b82f6', // Blue-500
  DIE:    '#ef4444', // Red-500
  DAS:    '#22c55e', // Green-500
  PLURAL: '#a855f7', // Purple-500
} as const

export type Gender = keyof typeof GENDER_COLORS

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type CefrLevel = typeof CEFR_LEVELS[number]
