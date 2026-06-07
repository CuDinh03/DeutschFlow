// IMPORTANT: this file MUST live at `src/middleware.ts` (this project uses a `src/` dir).
// At the project root it is silently ignored by Next.js and never compiled — which is exactly
// why the middleware did nothing in production for a long time. Do not move it back to the root.
import { jwtVerify, decodeProtectedHeader, importSPKI } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

type Role = 'STUDENT' | 'TEACHER' | 'ADMIN'

const AUTH_ACCESS_COOKIE = 'auth_access'
const AUTH_ROLE_COOKIE = 'auth_role'
// Persistent HttpOnly cookie set by the backend (com.deutschflow ... AuthController#REFRESH_TOKEN_COOKIE).
// Readable here because middleware runs server-side (HttpOnly only blocks document.cookie, not the
// request's Cookie header). Used to avoid bouncing a returning user whose access token has not been
// restored yet — see the !authenticatedRole branch below.
const AUTH_REFRESH_COOKIE = 'refresh_token'
const LOGIN_ROUTES = new Set(['/login', '/register'])

function roleHome(role: Role): string {
  if (role === 'ADMIN') return '/admin'
  if (role === 'TEACHER') return '/teacher'
  return '/student'
}

/** Trang chỉ dành cho một vai trò (prefix cứng). */
function requiredRole(pathname: string): Role | null {
  if (pathname.startsWith('/admin')) return 'ADMIN'
  if (pathname.startsWith('/teacher')) return 'TEACHER'
  if (pathname.startsWith('/student')) return 'STUDENT'
  return null
}

/** Trang học viên nhưng giáo viên/admin vẫn được mở (demo + tránh JWT/cookie STUDENT stale khi DB đã TEACHER). */
function learnerSharedPaths(): Set<string> {
  return new Set(['/dashboard', '/speaking', '/roadmap', '/onboarding', '/news'])
}

function requiresLearnerShare(pathname: string): boolean {
  return learnerSharedPaths().has(pathname)
}

function allowedOnLearnerPath(role: Role): boolean {
  return role === 'STUDENT' || role === 'TEACHER' || role === 'ADMIN'
}

function normalizeRole(value: unknown): Role | null {
  const role = String(value ?? '').trim().toUpperCase()
  if (role === 'ADMIN' || role === 'TEACHER' || role === 'STUDENT') return role
  return null
}

// RS256 verification (S18): import the public key once. JWT_RSA_PUBLIC_KEY is a \n-escaped PEM.
let rsaPublicKeyPromise: ReturnType<typeof importSPKI> | null = null
function loadRsaPublicKey(): ReturnType<typeof importSPKI> | null {
  const pem = process.env.JWT_RSA_PUBLIC_KEY
  if (!pem) return null
  if (!rsaPublicKeyPromise) {
    rsaPublicKeyPromise = importSPKI(pem.replace(/\\n/g, '\n'), 'RS256')
  }
  return rsaPublicKeyPromise
}

async function verifyAccessToken(token: string): Promise<Role | null> {
  // Pick the verifier from the token's own algorithm header — supports HS256 (current) and RS256
  // (S18 migration) at the same time, so signing can flip without breaking verification.
  let alg: string | undefined
  try {
    alg = decodeProtectedHeader(token).alg
  } catch {
    return null
  }

  try {
    if (alg === 'RS256') {
      const keyPromise = loadRsaPublicKey()
      if (!keyPromise) {
        console.error('[DeutschFlow] CRITICAL: RS256 token received but JWT_RSA_PUBLIC_KEY is not set.')
        return null
      }
      const { payload } = await jwtVerify(token, await keyPromise)
      return normalizeRole(payload.role)
    }

    // HS256 (default / transition) — verify with the shared secret.
    const secret = process.env.JWT_SECRET
    if (!secret) {
      console.error(
        '[DeutschFlow] CRITICAL: JWT_SECRET is not set and the token is not RS256. ' +
        'Set JWT_SECRET (HS256, must match the backend) or migrate fully to RS256 via JWT_RSA_PUBLIC_KEY.'
      )
      return null
    }
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
    return normalizeRole(payload.role)
  } catch (err) {
    console.error('Middleware: Token verification failed:', err)
    return null
  }
}

// ─── Content Security Policy (per-request nonce) ────────────────────────────────
// This is the STRICT, nonce-based policy, kept Report-Only. The ENFORCED production floor
// lives in next.config.mjs `headers()` instead, because Amplify serves most routes from the
// CloudFront cache without running middleware — so this header never reaches those users
// (verified: prod HTML has no nonce, no middleware CSP header). The enforced policy is set on
// the *request* header so Next.js stamps its <script> tags with the nonce; only the
// Report-Only variant is sent to the browser.
//
// Do NOT flip this to enforced while the next.config floor is also enforced: two CSP headers
// AND-intersect, so this nonce policy would block the floor's (necessarily non-nonce'd) inline
// scripts and white-screen the dynamic routes where middleware DOES run. The real upgrade path
// is to make middleware execute on Amplify, then drop the next.config floor and enforce here.
const backendOrigin = (process.env.NEXT_PUBLIC_BACKEND_URL || '').replace(/\/api\/?$/, '')
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'
const cloudfront = process.env.NEXT_PUBLIC_CLOUDFRONT_URL || ''

function buildCsp(nonce: string): string {
  const connectSrc = ["'self'", backendOrigin, posthogHost, cloudfront, 'https:']
    .filter(Boolean)
    .join(' ')
  return [
    "default-src 'self'",
    // 'strict-dynamic' + nonce is honored by modern browsers; 'unsafe-inline' + https: are
    // ignored there and act only as fallbacks for older browsers.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${posthogHost} https: 'unsafe-inline'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connectSrc}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ')
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Static assets and Next internals: no auth, no CSP needed.
  const isStaticAsset = /\.(?:ico|png|jpe?g|gif|svg|webp|avif|css|js|mjs|map|woff2?|ttf|eot|txt|xml|json|webmanifest)$/i.test(pathname)
  if (pathname.startsWith('/_next') || isStaticAsset) {
    return NextResponse.next()
  }

  const nonce = btoa(crypto.randomUUID())
  const csp = buildCsp(nonce)

  // Forward the nonce + enforced CSP on the *request* so Next.js nonces its inline scripts.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  // Attach the Report-Only CSP to every response we return.
  const secure = <T extends NextResponse>(res: T): T => {
    res.headers.set('Content-Security-Policy-Report-Only', csp)
    return res
  }
  const passThrough = () => secure(NextResponse.next({ request: { headers: requestHeaders } }))
  const redirectTo = (url: URL) => secure(NextResponse.redirect(url))

  const required = requiredRole(pathname)
  const learnerShare = requiresLearnerShare(pathname)
  const accessCookie = request.cookies.get(AUTH_ACCESS_COOKIE)?.value

  // Guard: if NO verifier is configured (neither HS256 secret nor RS256 public key) AND a protected
  // route is accessed, return 503 instead of silently redirecting to /login (infinite loop).
  const hasVerifier = Boolean(process.env.JWT_SECRET || process.env.JWT_RSA_PUBLIC_KEY)
  if (!hasVerifier && accessCookie && (required || learnerShare)) {
    return secure(new NextResponse(
      '<h1>503 — Server Misconfiguration</h1><p>No JWT verifier (JWT_SECRET or JWT_RSA_PUBLIC_KEY) is configured. Contact the administrator.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html' } }
    ))
  }

  // Routes that need no gating (public pages): attach CSP and pass through without a JWT verify.
  if (!required && !learnerShare && !LOGIN_ROUTES.has(pathname)) {
    return passThrough()
  }

  const authenticatedRole = accessCookie ? await verifyAccessToken(accessCookie) : null

  if (LOGIN_ROUTES.has(pathname) && authenticatedRole) {
    return redirectTo(new URL(roleHome(authenticatedRole), request.url))
  }

  if (!required && !learnerShare) {
    return passThrough()
  }

  if (!authenticatedRole) {
    // No valid access token on this request. The access mirror cookie (auth_access) is SESSION-scoped
    // (cleared on browser close), but refresh_token is a persistent HttpOnly cookie. A returning user
    // (browser reopened) therefore has the refresh cookie but no fresh access token yet — the client
    // restores it via the 401-refresh interceptor AFTER the page loads. Hard-redirecting here would
    // force a needless re-login. So only redirect when there is NO session at all (no refresh cookie);
    // otherwise let the request through so the client can restore the token. Role gating below still
    // applies once a valid access token is present; until then client guards + backend authz enforce.
    const hasRefreshSession = Boolean(request.cookies.get(AUTH_REFRESH_COOKIE)?.value)
    if (hasRefreshSession) {
      return passThrough()
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return redirectTo(loginUrl)
  }

  if (learnerShare) {
    if (!allowedOnLearnerPath(authenticatedRole)) {
      return redirectTo(new URL(roleHome(authenticatedRole), request.url))
    }
    return passThrough()
  }

  if (required !== authenticatedRole) {
    // If user is STUDENT but tries to access /admin, send them back to /dashboard
    // instead of a potential redirect loop to /student
    return redirectTo(new URL(roleHome(authenticatedRole), request.url))
  }

  return passThrough()
}

export const config = {
  // Run on every page so CSP applies site-wide. Exclude Next internals, API routes, and the favicon.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
