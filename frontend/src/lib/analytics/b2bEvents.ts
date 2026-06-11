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
   * Wired (checklist D1): `GET /org/analytics` now returns `monthlyTokenPool`
   * and `poolUsagePercent`, so the org dashboard fires this once per view when
   * the org has a configured pool (`monthlyTokenPool > 0`) and has consumed
   * `>= 80%` of it. Mirrors the backend `OrgQuotaService` 80% warn and the PPTX
   * hard-cap that enforces the pool ceiling.
   */
  TOKEN_POOL_THRESHOLD_80: 'token_pool_threshold_80',
  /**
   * Public lead magnet: a visitor submitted a Schreiben B1 essay for a free AI
   * grade and left a contact (checklist C8). Top-of-funnel acquisition signal.
   */
  LEAD_MAGNET_SUBMITTED: 'lead_magnet_submitted',
} as const

export type B2bEventName = (typeof B2B_EVENT)[keyof typeof B2B_EVENT]
