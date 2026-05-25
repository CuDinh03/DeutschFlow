/**
 * Shared text normalization + fuzzy scoring for vocab practice and error repair drills.
 */

export function normalizeWord(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(der|die|das|ein|eine|einen|einem|einer|eines)\b/g, '')
    .replace(/[^a-zäöüß\s]/gi, '')
    .trim()
    .replace(/\s+/g, ' ')
}

export function normalizeSentence(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-zäöüß0-9\s]/gi, '')
    .trim()
    .replace(/\s+/g, ' ')
}

export function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

/** Legacy vocab: compare heard transcript to target lemma */
export function isAcceptedHeardForWord(heard: string, baseForm: string): boolean {
  const target = normalizeWord(baseForm)
  const attempt = normalizeWord(heard)
  if (!attempt || !target) return false
  if (attempt === target) return true
  const threshold = target.length <= 5 ? 1 : 2
  return levenshtein(attempt, target) <= threshold
}

export interface OrderConstraint {
  before: string
  after: string
}

export interface DrillScoringRule {
  anchors_required?: string[]
  anchors_forbidden?: string[]
  order_constraints?: OrderConstraint[]
  levenshtein_max_ratio?: number
}

export interface ScoreAttemptResult {
  pass: boolean
  normalizedAttempt: string
  missingAnchors: string[]
  orderViolations: string[]
  ratio: number
}

function tokenSet(text: string): Set<string> {
  return new Set(normalizeWord(text).split(/\s+/).filter(Boolean))
}

export function checkAnchors(normalizedAttempt: string, required: string[], forbidden: string[]): {
  missing: string[]
  forbiddenHit: string[]
} {
  const tokens = tokenSet(normalizedAttempt)
  const missing = (required ?? []).filter((w) => !tokens.has(normalizeWord(w)))
  const forbiddenHit = (forbidden ?? []).filter((w) => tokens.has(normalizeWord(w)))
  return { missing, forbiddenHit }
}

/** Very lightweight order check: indices of before token must be less than after token */
export function checkOrder(normalizedAttempt: string, constraints: OrderConstraint[]): string[] {
  const words = normalizedAttempt.trim().split(/\s+/).filter(Boolean)
  const violations: string[] = []
  for (const { before, after } of constraints ?? []) {
    const ib = words.findIndex((w) => normalizeWord(w) === normalizeWord(before))
    const ia = words.findIndex((w) => normalizeWord(w) === normalizeWord(after))
    if (ib >= 0 && ia >= 0 && ib >= ia) {
      violations.push(`${before} before ${after}`)
    }
  }
  return violations
}

export function scoreAttempt(
  rawAttempt: string,
  targetGerman: string | undefined,
  rule: DrillScoringRule | undefined
): ScoreAttemptResult {
  const normalizedAttempt = normalizeSentence(rawAttempt)
  const missingAnchors: string[] = []
  const orderViolations: string[] = []
  if (!rule) {
    const ratio =
      targetGerman && normalizedAttempt.length > 0
        ? levenshtein(normalizedAttempt, normalizeSentence(targetGerman)) /
          Math.max(normalizedAttempt.length, normalizeSentence(targetGerman).length, 1)
        : 1
    return {
      pass: ratio <= 0.25, // Allow 25% difference (typos, punctuation, small omissions)
      normalizedAttempt,
      missingAnchors,
      orderViolations,
      ratio,
    }
  }

  const { missing, forbiddenHit } = checkAnchors(
    normalizedAttempt,
    rule.anchors_required ?? [],
    rule.anchors_forbidden ?? []
  )
  missingAnchors.push(...missing)

  orderViolations.push(...checkOrder(normalizedAttempt, rule.order_constraints ?? []))

  let ratio = 0
  if (targetGerman) {
    const nt = normalizeSentence(targetGerman)
    ratio =
      nt.length > 0
        ? levenshtein(normalizedAttempt, nt) / Math.max(normalizedAttempt.length, nt.length, 1)
        : 1
  }

  const maxRatio = rule.levenshtein_max_ratio ?? 0.35
  const pass =
    missing.length === 0 &&
    forbiddenHit.length === 0 &&
    orderViolations.length === 0 &&
    ratio <= maxRatio

  return {
    pass,
    normalizedAttempt,
    missingAnchors,
    orderViolations,
    ratio,
  }
}
