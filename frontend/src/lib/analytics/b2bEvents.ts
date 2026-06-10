/**
 * B2B / org funnel analytics event names (GTM plan §9).
 *
 * Centralized so the 8-event activation funnel stays consistent across every
 * surface that fires it. Fire via `useTracking().trackEvent(B2B_EVENT.x, {...})`.
 *
 * Funnel order (supply → activation → engagement):
 *   org_created → org_seat_activated / org_csv_import_completed →
 *   assignment_created → assignment_ai_graded → assignment_teacher_finalized,
 *   with org_dashboard_viewed as the owner-engagement signal.
 */
export const B2B_EVENT = {
  /** Platform admin provisions a new org (supply-side). */
  ORG_CREATED: 'org_created',
  /** One or more student seats become active (e.g. via CSV import). */
  ORG_SEAT_ACTIVATED: 'org_seat_activated',
  /** A roster CSV import finished (with per-outcome counts). */
  ORG_CSV_IMPORT_COMPLETED: 'org_csv_import_completed',
  /** A teacher created a class assignment. */
  ASSIGNMENT_CREATED: 'assignment_created',
  /** AI grading produced a suggested score for a submission. */
  ASSIGNMENT_AI_GRADED: 'assignment_ai_graded',
  /** A teacher reviewed + finalized a grade. */
  ASSIGNMENT_TEACHER_FINALIZED: 'assignment_teacher_finalized',
  /** An org admin/owner opened the org dashboard. */
  ORG_DASHBOARD_VIEWED: 'org_dashboard_viewed',
  /**
   * Org AI token pool crossed 80% of its monthly limit.
   *
   * DEFERRED to GĐ2 / checklist D1 (token-pool enforcement): the org-side
   * analytics response currently exposes `tokensThisMonth` (used) but NOT the
   * pool limit, so an honest 80% threshold can't be computed client-side yet.
   * Wire this when the pool limit is plumbed through org analytics alongside
   * the QuotaService pool check.
   */
  TOKEN_POOL_THRESHOLD_80: 'token_pool_threshold_80',
} as const

export type B2bEventName = (typeof B2B_EVENT)[keyof typeof B2B_EVENT]
