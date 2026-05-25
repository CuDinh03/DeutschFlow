import api from './api'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface AchievementDto {
  id: number
  code: string
  nameVi: string
  descriptionVi: string
  iconEmoji: string
  xpReward: number
  rarity: string
  unlocked: boolean
}

export interface XpSummaryDto {
  userId: number
  totalXp: number
  level: number
  progressInLevel: number
  xpNeededForNext: number
  achievements: AchievementDto[]
  pendingBadges: AchievementDto[]
}

export interface LeaderboardEntry {
  rank: number
  userId: number
  displayName: string
  totalXp: number
  level: number
}

// ─────────────────────────────────────────────
// API adapter
// ─────────────────────────────────────────────

export const xpApi = {
  /** GET /api/xp/me — full XP summary + achievements + pending badges */
  getMyXp: () =>
    api.get<XpSummaryDto>('/xp/me').then(r => r.data),

  /** POST /api/xp/me/badges/ack — mark pending badges as shown */
  ackBadges: () =>
    api.post('/xp/me/badges/ack').then(r => r.data),

  /** GET /api/xp/leaderboard?limit=N — top users by XP */
  getLeaderboard: (limit = 20) =>
    api.get<LeaderboardEntry[]>('/xp/leaderboard', { params: { limit } })
      .then(r => r.data),
}
