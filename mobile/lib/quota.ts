/**
 * Detect the backend's "AI quota / trial exhausted" response so the UI can offer an upgrade path
 * instead of a dead-end error.
 *
 * The backend maps QuotaExceededException to HTTP 429 with an RFC-7807 ProblemDetail whose `type`
 * ends with `quota-exceeded` and whose `detail` is a Vietnamese message (e.g. the 7-day trial expiry).
 * Note: 429 is ALSO used for rate limiting (`rate-limit-exceeded`) — that is NOT a quota problem and
 * must not trigger an upsell, so we discriminate on `type`, not the status code alone.
 *
 * Pure and structural (no axios import) so it is unit-testable with plain objects.
 */

interface ProblemLike {
  type?: unknown
  detail?: unknown
}

interface ParsedProblem {
  status: number
  type: string
  detail: string
}

function parseProblem(error: unknown): ParsedProblem | null {
  if (!error || typeof error !== 'object') return null
  const response = (error as { response?: { status?: unknown; data?: unknown } }).response
  if (!response || typeof response.status !== 'number') return null
  const data = response.data
  const problem: ProblemLike = data && typeof data === 'object' ? (data as ProblemLike) : {}
  return {
    status: response.status,
    type: typeof problem.type === 'string' ? problem.type : '',
    detail: typeof problem.detail === 'string' ? problem.detail : '',
  }
}

/** True when the request failed because the user is out of AI quota or their trial has expired. */
export function isQuotaExceededError(error: unknown): boolean {
  const p = parseProblem(error)
  if (!p || p.status !== 429) return false
  if (p.type.endsWith('quota-exceeded')) return true
  // A rate-limit 429 is explicitly not a quota problem.
  if (p.type.endsWith('rate-limit-exceeded')) return false
  // Fallback only when the type is missing (older/proxied responses): match quota wording.
  return /dùng thử|hạn mức|quota|token/i.test(p.detail)
}

/** True specifically when the 7-day PRO trial has run out (a subset of quota-exceeded). */
export function isTrialExpiredError(error: unknown): boolean {
  if (!isQuotaExceededError(error)) return false
  return /dùng thử/i.test(parseProblem(error)?.detail ?? '')
}

/** The server's human-readable quota/trial message, or null when there isn't one. */
export function quotaExceededMessage(error: unknown): string | null {
  return parseProblem(error)?.detail || null
}
