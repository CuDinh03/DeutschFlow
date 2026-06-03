// Typed client for XP & achievements (gamification). Field names mirror the
// backend DTOs (XpSummaryDto, AchievementDto, LeaderboardDto).

import api from './api'

export type Rarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'

export interface Achievement {
  id: number
  code: string
  nameVi: string
  descriptionVi: string
  iconEmoji: string
  xpReward: number
  rarity: Rarity
  unlocked: boolean
}

export interface XpSummary {
  userId: number
  totalXp: number
  level: number
  progressInLevel: number
  xpNeededForNext: number
  allAchievements: Achievement[]
  pendingBadges: Achievement[]
}

export interface LeaderboardEntry {
  rank: number
  userId: number
  displayName: string
  totalXp: number
  level: number
}

export const gamificationApi = {
  /** Full XP summary + achievements + pending (newly unlocked) badges. */
  getXpSummary: () => api.get<XpSummary>('/xp/me').then((r) => r.data),

  /** Mark pending badges as seen (call after showing the user). */
  ackBadges: () => api.post('/xp/me/badges/ack'),

  /** Top-N users by XP (displayName + XP only). */
  getLeaderboard: (limit = 20) =>
    api.get<LeaderboardEntry[]>('/xp/leaderboard', { params: { limit } }).then((r) => r.data),
}
