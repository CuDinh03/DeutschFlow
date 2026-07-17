import { describe, it, expect, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from './middleware'

// Build a request at the given (trailing-slash) path with an optional cookie set. NextRequest parses
// the `cookie` header into request.cookies, which is what the middleware reads.
function req(path: string, cookies: Record<string, string> = {}): NextRequest {
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('; ')
  return new NextRequest(`https://app.test${path}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  })
}

function isPassThrough(res: Response): boolean {
  // NextResponse.next() carries this header and no Location; a redirect carries a Location.
  return res.headers.get('location') === null
}

const ENV_KEYS = ['JWT_SECRET', 'JWT_RSA_PUBLIC_KEY'] as const

function setVerifier(present: boolean): void {
  for (const k of ENV_KEYS) delete process.env[k]
  if (present) process.env.JWT_SECRET = 'test-hs256-secret'
}

describe('middleware — /v2 role-area anonymous bounce', () => {
  const snapshot = { ...process.env }
  afterEach(() => {
    for (const k of ENV_KEYS) delete process.env[k]
    if (snapshot.JWT_SECRET) process.env.JWT_SECRET = snapshot.JWT_SECRET
    if (snapshot.JWT_RSA_PUBLIC_KEY) process.env.JWT_RSA_PUBLIC_KEY = snapshot.JWT_RSA_PUBLIC_KEY
  })

  // The core prod regression: with NO verifier configured on Amplify, the whole edge gate used to
  // degrade to passthrough and leak the role-area shell to logged-out visitors. The bounce must fire
  // on cookie-presence alone, without a verifier.
  it('redirects anonymous (no cookies) on /v2/admin/users to /v2/login WITHOUT a verifier', async () => {
    setVerifier(false)
    const res = await middleware(req('/v2/admin/users/'))
    expect(res.status).toBe(307)
    const loc = res.headers.get('location') ?? ''
    expect(loc).toContain('/v2/login')
    expect(loc).toContain('next=%2Fv2%2Fadmin%2Fusers%2F')
  })

  it('redirects anonymous on /v2/student/dashboard to /v2/login WITHOUT a verifier', async () => {
    setVerifier(false)
    const res = await middleware(req('/v2/student/dashboard/'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location') ?? '').toContain('/v2/login')
  })

  it('redirects anonymous on /v2/teacher and /v2/org too', async () => {
    setVerifier(false)
    for (const p of ['/v2/teacher/', '/v2/org/']) {
      const res = await middleware(req(p))
      expect(res.status, `path ${p}`).toBe(307)
      expect(res.headers.get('location') ?? '', `path ${p}`).toContain('/v2/login')
    }
  })

  it('still redirects anonymous WHEN a verifier IS present (same outcome, earlier branch)', async () => {
    setVerifier(true)
    const res = await middleware(req('/v2/admin/users/'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location') ?? '').toContain('/v2/login')
  })

  // A returning user carries the persistent HttpOnly refresh cookie but may have lost the session-scoped
  // access mirror. They must NOT be bounced — the client restores the access token after load.
  it('passes a returning user (refresh cookie only) through without a verifier', async () => {
    setVerifier(false)
    const res = await middleware(req('/v2/admin/users/', { refresh_token: 'r' }))
    expect(isPassThrough(res)).toBe(true)
  })

  it('passes a user with an access mirror cookie through without a verifier (graceful degrade)', async () => {
    setVerifier(false)
    const res = await middleware(req('/v2/student/dashboard/', { auth_access: 'a' }))
    expect(isPassThrough(res)).toBe(true)
  })

  // Guardrails: the bounce must never touch the login/register/guest/invite surfaces, or it would
  // create a redirect loop (login → login) or lock invited teachers out of the public accept page.
  it('does NOT bounce /v2/login (no loop) even anonymous + no verifier', async () => {
    setVerifier(false)
    const res = await middleware(req('/v2/login/'))
    expect(isPassThrough(res)).toBe(true)
  })

  it('does NOT bounce the guest /v2/onboarding funnel', async () => {
    setVerifier(false)
    const res = await middleware(req('/v2/onboarding/'))
    expect(isPassThrough(res)).toBe(true)
  })

  it('does NOT bounce the public /v2/org/accept invite page', async () => {
    setVerifier(false)
    const res = await middleware(req('/v2/org/accept/'))
    expect(isPassThrough(res)).toBe(true)
  })
})
