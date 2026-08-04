/**
 * Test JWTs used by the E2E specs to inject a pre-authenticated session.
 *
 * These are MINTED AT RUN TIME, never hardcoded. Two reasons, both learned the hard way:
 *
 *  1. A literal token carries a frozen `exp` and rots silently. The previous pair expired
 *     2026-05-17 while the docstring right above it still promised "expires 2027-05-26" — the
 *     specs only kept passing because the dev server runs with no JWT verifier configured (see
 *     below), so nobody was checking the signature or the expiry.
 *  2. CI's gitleaks `jwt` rule matches any three-part base64 literal and blocks the merge, so a
 *     freshly baked literal could not land anyway (see /.gitleaksignore for the last time this bit).
 *
 * Minting per run fixes both: `exp` is always a year out and no secret-shaped string is committed.
 *
 * SIGNING — HS256 over E2E_JWT_SECRET. `src/middleware.ts` only verifies the signature when the
 * server under test has a verifier configured (JWT_SECRET for HS256, JWT_RSA_PUBLIC_KEY for RS256);
 * with neither set it degrades to cookie-presence gating and never looks at the signature. So the
 * default secret below is enough for the specs as they run today. To actually exercise the edge
 * role gate, start the dev server with a matching secret:
 *
 *   E2E_JWT_SECRET=my-test-secret JWT_SECRET=my-test-secret npm run dev
 *
 * Signing is deliberately synchronous (node:crypto HMAC rather than jose's async `SignJWT`) so the
 * tokens stay plain module constants and the specs can keep using them without awaiting.
 */
import { createHmac } from 'node:crypto'

/** Must match the server's JWT_SECRET for the middleware to verify these. See the note above. */
const E2E_JWT_SECRET = process.env.E2E_JWT_SECRET ?? 'deutschflow-e2e-test-secret'

/** One year. Irrelevant in practice — every run mints fresh — but keeps `exp` sane if one is reused. */
const TOKEN_TTL_SECONDS = 365 * 24 * 60 * 60

function base64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function signJwt(claims: Record<string, unknown>): string {
  const issuedAt = Math.floor(Date.now() / 1000)
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64Url(
    JSON.stringify({ ...claims, iat: issuedAt, exp: issuedAt + TOKEN_TTL_SECONDS }),
  )
  const signature = createHmac('sha256', E2E_JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url')
  return `${header}.${payload}.${signature}`
}

/** STUDENT role, sub=1. Valid for a year from whenever this module is loaded. */
export const STUDENT_TOKEN = signJwt({ role: 'STUDENT', sub: '1' })

/** TEACHER role, sub=2. Valid for a year from whenever this module is loaded. */
export const TEACHER_TOKEN = signJwt({ role: 'TEACHER', sub: '2' })

/**
 * Structurally valid STUDENT JWT whose signature is intentionally garbage — for mocked-route tests
 * where the middleware is never reached and verification must NOT succeed.
 * No spec imports this today; kept because "a JWT that fails verification" is awkward to rebuild
 * correctly at the call site.
 */
export const MOCK_STUDENT_TOKEN = [
  base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
  base64Url(JSON.stringify({ role: 'STUDENT', sub: '1' })),
  'not-a-real-signature',
].join('.')

export function studentCookies(domain = 'localhost') {
  return [
    { name: 'auth_access', value: STUDENT_TOKEN, domain, path: '/' },
    { name: 'auth_role', value: 'STUDENT', domain, path: '/' },
    { name: 'auth_logged_in', value: '1', domain, path: '/' },
  ]
}

export function teacherCookies(domain = 'localhost') {
  return [
    { name: 'auth_access', value: TEACHER_TOKEN, domain, path: '/' },
    { name: 'auth_role', value: 'TEACHER', domain, path: '/' },
    { name: 'auth_logged_in', value: '1', domain, path: '/' },
  ]
}
