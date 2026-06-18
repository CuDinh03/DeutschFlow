import api from './api'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** Spendable coin balance. Coins are earned 1-per-learning-node and spent on bonus access. */
export interface CoinBalance {
  balance: number
}

export interface CoinEvent {
  id: number
  /** > 0 earn, < 0 spend. */
  amount: number
  eventType: string
  note: string | null
  createdAt: string
}

// ─────────────────────────────────────────────
// API adapter
// ─────────────────────────────────────────────

export const coinApi = {
  /** GET /api/coins/me — current coin balance. */
  getBalance: () => api.get<CoinBalance>('/coins/me').then(r => r.data),

  /** GET /api/coins/history — ledger, newest first. */
  getHistory: (page = 0, size = 20) =>
    api.get<CoinEvent[]>('/coins/history', { params: { page, size } }).then(r => r.data),

  /** GET /api/coins/mock-trial-passes?packId — does the user hold an unused trial pass for this pack? */
  getTrialPass: (packId: number) =>
    api
      .get<{ hasActivePass: boolean }>('/coins/mock-trial-passes', { params: { packId } })
      .then(r => r.data),

  /** POST /api/coins/mock-trial-passes — spend coins for a single-attempt trial pass. Returns new balance. */
  buyTrialPass: (packId: number) =>
    api.post<CoinBalance>('/coins/mock-trial-passes', { packId }).then(r => r.data),

  /** GET /api/coins/bonus-speaking-sessions — bonus AI-speaking tokens granted for today. */
  getBonusSpeaking: () =>
    api.get<{ tokensToday: number }>('/coins/bonus-speaking-sessions').then(r => r.data),

  /** POST /api/coins/bonus-speaking-sessions — spend coins for a one-day speaking top-up. Returns new balance. */
  buyBonusSpeaking: () =>
    api.post<CoinBalance>('/coins/bonus-speaking-sessions').then(r => r.data),
}
