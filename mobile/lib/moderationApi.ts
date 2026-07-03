// UGC safety (Apple Guideline 1.2): block users + report content/users. Mirrors backend
// ModerationController (/api/moderation) and ModerationDtos exactly.

import api from './api'

export interface BlockedUser {
  userId: number
  displayName: string
  blockedAt: string
}

export type ReportContext = 'DIRECT_MESSAGE' | 'CLASS_MESSAGE' | 'USER'
export type ReportReason = 'HARASSMENT' | 'SEXUAL' | 'HATE' | 'SPAM' | 'OTHER'

export interface ReportInput {
  context: ReportContext
  reason: ReportReason
  targetUserId?: number
  messageId?: number
  classMessageId?: number
  classId?: number
  details?: string
}

export const moderationApi = {
  /** Block a user (idempotent) — they can no longer message you and their content is hidden. */
  block: (userId: number) => api.post('/moderation/block', { userId }).then(() => undefined),

  /** Unblock a user (idempotent). */
  unblock: (userId: number) => api.delete(`/moderation/block/${userId}`).then(() => undefined),

  /** Users the caller has blocked (for the Safety / Blocked-users screen). */
  blocks: () => api.get<BlockedUser[]>('/moderation/blocks').then((r) => r.data ?? []),

  /** Report a message or a user. */
  report: (input: ReportInput) =>
    api.post<{ reportId: number }>('/moderation/report', input).then((r) => r.data),
}
