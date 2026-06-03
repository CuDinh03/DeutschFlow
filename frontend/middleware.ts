import { jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

type Role = 'STUDENT' | 'TEACHER' | 'ADMIN'

const AUTH_ACCESS_COOKIE = 'auth_access'
const AUTH_ROLE_COOKIE = 'auth_role'
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

async function verifyAccessToken(token: string): Promise<Role | null> {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    // JWT_SECRET is missing — this is a misconfiguration, not a bad token.
    // Log a loud warning so it appears in Amplify/CloudWatch logs.
    console.error(
      '[DeutschFlow] CRITICAL: JWT_SECRET environment variable is not set. ' +
      'All authenticated requests will be rejected. ' +
      'Fix: set JWT_SECRET in AWS Amplify Console → App settings → Environment variables ' +
      '(must match the backend JWT_SECRET value).'
    )
    return null
  }
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
    return normalizeRole(payload.role)
  } catch (err) {
    console.error('Middleware: Token verification failed:', err)
    return null
  }
}

// ─── Content Security Policy (per-request nonce) ────────────────────────────────
// Shipped as Report-Only so it cannot break prod. The ENFORCED policy is set on the
// *request* header so Next.js stamps its own <script> tags with the nonce; only the
// Report-Only variant is sent to the browser. To enforce later (S17 flip): change the
// response header name below from 'Content-Security-Policy-Report-Only' to
// 'Content-Security-Policy' once the violation reports are clean.
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

  // Guard: if JWT_SECRET is missing AND a protected route is accessed,
  // return 503 instead of silently redirecting to /login (which causes an infinite loop).
  if (!process.env.JWT_SECRET && accessCookie && (required || learnerShare)) {
    return secure(new NextResponse(
      '<h1>503 — Server Misconfiguration</h1><p>JWT_SECRET is not configured. Contact the administrator.</p>',
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
