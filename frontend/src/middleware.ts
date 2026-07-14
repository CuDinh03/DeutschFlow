// IMPORTANT: this file MUST live at `src/middleware.ts` (this project uses a `src/` dir).
// At the project root it is silently ignored by Next.js and never compiled — which is exactly
// why the middleware did nothing in production for a long time. Do not move it back to the root.
import { jwtVerify, decodeProtectedHeader, importSPKI } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

type Role = 'STUDENT' | 'TEACHER' | 'MANAGER' | 'OWNER' | 'ADMIN'

// MANAGER/OWNER are first-class PLATFORM roles (2026-06-22): a centre manager/owner is its own global
// identity, NOT a TEACHER, and is strictly administrative (no teacher access). They route to /v2/org.
// The org-scoped `orgRole` claim (OWNER|MANAGER) is still emitted by JwtService and still gates /org/*
// — it works for both new tokens (role=OWNER/MANAGER) and any legacy token (role=TEACHER) until expiry,
// so the cutover needs no forced re-login.
type OrgRole = 'OWNER' | 'MANAGER'

// Verified token claims relevant to routing. orgRole is null for B2C / non-org users.
type VerifiedClaims = { role: Role; orgRole: OrgRole | null }

const AUTH_ACCESS_COOKIE = 'auth_access'
const AUTH_ROLE_COOKIE = 'auth_role'
// Persistent HttpOnly cookie set by the backend (com.deutschflow ... AuthController#REFRESH_TOKEN_COOKIE).
// Readable here because middleware runs server-side (HttpOnly only blocks document.cookie, not the
// request's Cookie header). Used to avoid bouncing a returning user whose access token has not been
// restored yet — see the !authenticatedRole branch below.
const AUTH_REFRESH_COOKIE = 'refresh_token'
// Cả bốn bề mặt đăng nhập: hai của v1 (đã được next.config redirect sang v2 — giữ ở đây làm lớp
// phòng thủ thứ hai) và hai của v2. Người đã đăng nhập gõ vào bất kỳ cái nào đều bị đá về nhà.
// Trước đây tập này chỉ có path v1, nên `/v2/login` KHÔNG có bounce: user đã đăng nhập vẫn thấy
// form và đăng nhập lại được — chính là đường dẫn tới "đăng nhập nhầm" mà đợt này phải bịt.
const LOGIN_ROUTES = new Set(['/login', '/register', '/v2/login', '/v2/register'])

/**
 * `trailingSlash: true` (next.config.mjs) means every real pathname ends in "/" — the URL the
 * middleware sees is `/login/`, never `/login`. Any EXACT string comparison below therefore has to
 * run on the de-slashed form, or it silently never matches (that is how the logged-in→home bounce
 * and the public `/org/accept` exemption both went dead). Prefix checks (startsWith) are unaffected.
 */
function routeKey(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/'
}

/**
 * `?next=` chỉ được phép là đường dẫn NỘI BỘ. Chặn open-redirect: `//evil.com` và
 * `https://evil.com` đều bị loại; chỉ nhận path bắt đầu bằng đúng một dấu "/".
 */
function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

// Trang chủ theo vai trò trên Galerie v2 — đích DUY NHẤT của mọi lần đá người dùng trong file này.
// Bản đồ `roleHome()` legacy (/admin, /teacher, /student, /org) đã bị xoá: nó chính là thứ kéo người
// đã đăng nhập ngược về UI cũ. Sửa vai trò ở đây thì soát lại `homeFor()` trong `lib/roleRouting.ts`.
function v2RoleHome(role: Role): string {
  if (role === 'ADMIN') return '/v2/admin/users'
  if (role === 'OWNER' || role === 'MANAGER') return '/v2/org'
  if (role === 'TEACHER') return '/v2/teacher'
  return '/v2/student/dashboard'
}

/** Trang chỉ dành cho một vai trò (prefix cứng). */
function requiredRole(pathname: string): Role | null {
  if (pathname.startsWith('/admin')) return 'ADMIN'
  if (pathname.startsWith('/teacher')) return 'TEACHER'
  if (pathname.startsWith('/student')) return 'STUDENT'
  return null
}

/**
 * /org/* is gated by the SEPARATE orgRole claim (OWNER|MANAGER), not the global role — the centre
 * owner stays global TEACHER. Note: /org is NOT in requiredRole() on purpose; it has its own branch.
 *
 * EXCEPTION: /org/accept is the PUBLIC invite-acceptance page. Invited teachers reach it from an
 * email link with NO existing session (they may not even have an account yet) — the token in the
 * query string is the secret and the page guards itself. Gating it would bounce exactly the users
 * it targets to /login, so it must pass through ungated (mirrors how /onboarding stays guest-reachable).
 * The exemption compares on routeKey(): the live URL is `/org/accept/` and the un-slashed compare
 * never matched, so the invite link was gated → /login?next=… , dropping the ?token= secret with it.
 */
function requiresOrg(pathname: string): boolean {
  if (routeKey(pathname) === '/org/accept') return false
  return pathname.startsWith('/org')
}

/**
 * Funnel onboarding "value-first": KHÁCH (chưa có tài khoản) chạy hết funnel rồi mới đăng ký, nên
 * hai route này phải lọt qua cổng đăng nhập (xem nhánh `!authenticatedRole` bên dưới).
 * `/v2/onboarding` là bản port Galerie của `/onboarding` — thiếu nó ở đây thì user mới của v2
 * (đăng ký xong bị đẩy tới `/v2/onboarding`) và mọi khách vào thẳng đều bị đá về `/v2/login`.
 *
 * CHỈ hai path GỐC này được miễn. Hai nhánh con `/v2/onboarding/mock-exam` và
 * `/v2/onboarding/error-report` không nằm trong tập nào (giống hệt `/onboarding/mock-exam` ở v1):
 * chúng rơi vào nhánh "trang công khai" và tự gọi API có auth để tự gác mình.
 */
const GUEST_ONBOARDING_ROUTES = new Set(['/onboarding', '/v2/onboarding'])

/** Trang học viên nhưng giáo viên/admin vẫn được mở (demo + tránh JWT/cookie STUDENT stale khi DB đã TEACHER). */
function learnerSharedPaths(): Set<string> {
  return new Set(['/dashboard', '/speaking', '/roadmap', '/onboarding', '/v2/onboarding', '/news'])
}

function requiresLearnerShare(pathname: string): boolean {
  return learnerSharedPaths().has(routeKey(pathname))
}

/**
 * Bản /v2 của learnerSharedPaths. Mọi route dưới `/v2/student/*` mặc định bị cổng vai trò
 * STUDENT chặn (requiredRole('/student/…') === 'STUDENT'), nên một trang vốn DÙNG CHUNG ở v1 sẽ
 * mất quyền của GV/admin khi port sang đây.
 *
 * `/v2/student/news` là port của `/news` — vốn nằm trong learnerSharedPaths() ở trên (GV/admin
 * cũng đọc báo Đức). Thiếu ngoại lệ này thì sau khi xoá cây v1, GV/admin bấm vào tin tức sẽ bị đá
 * về trang chủ vai trò của họ.
 */
const V2_LEARNER_SHARED = new Set(['/v2/student/news'])

function allowedOnLearnerPath(role: Role): boolean {
  return role === 'STUDENT' || role === 'TEACHER' || role === 'ADMIN'
}

function normalizeRole(value: unknown): Role | null {
  const role = String(value ?? '').trim().toUpperCase()
  if (role === 'ADMIN' || role === 'OWNER' || role === 'MANAGER' || role === 'TEACHER' || role === 'STUDENT') {
    return role as Role
  }
  return null
}

// Only OWNER/MANAGER may enter /org/*. TEACHER/STUDENT memberships (or absent claim) → null = no access.
// 'ADMIN' is accepted as a legacy alias for MANAGER (pre-V225 tokens) so a token minted right before
// the rename still routes correctly until it expires; the backend no longer emits it.
function normalizeOrgRole(value: unknown): OrgRole | null {
  const orgRole = String(value ?? '').trim().toUpperCase()
  if (orgRole === 'OWNER') return 'OWNER'
  if (orgRole === 'MANAGER' || orgRole === 'ADMIN') return 'MANAGER'
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

async function verifyAccessToken(token: string): Promise<VerifiedClaims | null> {
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
      const role = normalizeRole(payload.role)
      return role ? { role, orgRole: normalizeOrgRole(payload.orgRole) } : null
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
    const role = normalizeRole(payload.role)
    return role ? { role, orgRole: normalizeOrgRole(payload.orgRole) } : null
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

  // ĐÃ GỠ: kill-switch `GALERIE_V2_DISABLED` (bounce mọi /v2/* về path legacy tương ứng).
  //
  // Vì sao phải gỡ NGAY trong đợt này, không đợi tới lúc xoá cây v1: từ nay `next.config.mjs`
  // redirect /login → /v2/login. Nếu kill-switch còn sống và ai đó bật nó, /v2/login sẽ bị đá về
  // /login, rồi next.config lại đá ngược lên /v2/login → VÒNG LẶP REDIRECT VÔ HẠN, chết cả site.
  // Bản thân kill-switch cũng đã mất tác dụng từ lúc cutover: V2Gate là passthrough và chính trang
  // /login legacy cũng đẩy người dùng sang bề mặt v2 sau khi đăng nhập.
  //
  // Rollback thay thế: revert commit / redeploy bản trước trên Amplify (env GALERIE_V2_DISABLED
  // không còn được đọc ở bất kỳ đâu — xoá nó khỏi Amplify để khỏi ai bật nhầm theo runbook cũ).

  // UI 2.0 (Galerie v2) EDGE auth gate. The /v2 role areas have their OWN login (/v2/login) and role
  // homes, so the legacy gating below — which only matches unprefixed paths — never covers them and
  // leaves /v2/admin/* etc. reachable (shell visible) by anonymous users. Gate them here, keeping the
  // user inside /v2. Strip the "/v2" prefix to reuse the same role/org resolution. Degrade gracefully
  // when no JWT verifier is configured (same posture as the legacy gate below — see the #67 note).
  const hasVerifierForV2 = Boolean(process.env.JWT_SECRET || process.env.JWT_RSA_PUBLIC_KEY)
  if (pathname.startsWith('/v2/') && hasVerifierForV2) {
    const v2Path = pathname.slice(3) || '/'
    const v2Required = requiredRole(v2Path)
    const v2Org = requiresOrg(v2Path)
    if (v2Required || v2Org) {
      const v2Access = request.cookies.get(AUTH_ACCESS_COOKIE)?.value
      const v2Claims = v2Access ? await verifyAccessToken(v2Access) : null
      const v2Role = v2Claims?.role ?? null
      if (!v2Role) {
        // Returning user with only the persistent refresh cookie: let the client restore the access
        // token (matches the legacy !authenticatedRole branch) rather than forcing a re-login.
        if (request.cookies.get(AUTH_REFRESH_COOKIE)?.value) {
          return passThrough()
        }
        const loginUrl = new URL('/v2/login', request.url)
        loginUrl.searchParams.set('next', pathname)
        return redirectTo(loginUrl)
      }
      if (v2Org) {
        // Platform OWNER/MANAGER always have org access (new roles, V235+).
        // Legacy: TEACHER with org-level OWNER/MANAGER orgRole claim still works until token expiry.
        // ADMIN platform role is intentionally excluded even if they carry an orgRole claim.
        const canAccessOrg =
          v2Role === 'OWNER' ||
          v2Role === 'MANAGER' ||
          (v2Role === 'TEACHER' && (v2Claims?.orgRole === 'OWNER' || v2Claims?.orgRole === 'MANAGER'))
        if (canAccessOrg) {
          return passThrough()
        }
        return redirectTo(new URL(v2RoleHome(v2Role), request.url))
      }
      // Trang /v2 dùng chung cho người học (xem V2_LEARNER_SHARED): STUDENT/TEACHER/ADMIN đều vào
      // được, đúng như bản v1 tương ứng. Phải xét TRƯỚC cổng vai trò cứng bên dưới.
      if (V2_LEARNER_SHARED.has(routeKey(pathname))) {
        if (!allowedOnLearnerPath(v2Role)) {
          return redirectTo(new URL(v2RoleHome(v2Role), request.url))
        }
        return passThrough()
      }
      if (v2Required !== v2Role) {
        return redirectTo(new URL(v2RoleHome(v2Role), request.url))
      }
      return passThrough()
    }
  }

  const required = requiredRole(pathname)
  const learnerShare = requiresLearnerShare(pathname)
  const orgGated = requiresOrg(pathname)
  const accessCookie = request.cookies.get(AUTH_ACCESS_COOKIE)?.value

  // No JWT verifier configured (neither HS256 secret nor RS256 public key) → the middleware
  // physically cannot verify tokens. DEGRADE GRACEFULLY to the app's prior posture (client-side
  // route guards + backend authorization), which ran safely for months before this middleware
  // executed at all. The backend independently verifies every JWT on every request, so passing
  // through here is NOT a security regression — it only disables the edge UX/role-routing layer.
  // A hard 503 here instead white-screens the ENTIRE authenticated app the moment a verifier env
  // var is missing or mid-rotation (this is exactly the #67 outage). The loud, fail-fast signal
  // belongs at DEPLOY time in amplify.yml's build guard; this branch is the runtime safety net so
  // a single missing env var can never take prod down again.
  const hasVerifier = Boolean(process.env.JWT_SECRET || process.env.JWT_RSA_PUBLIC_KEY)
  if (!hasVerifier) {
    if (required || learnerShare || orgGated) {
      console.error(
        '[DeutschFlow] CRITICAL: no JWT verifier configured. Set JWT_RSA_PUBLIC_KEY (RS256, ' +
        'production) or JWT_SECRET (HS256, must match backend). Edge auth gating is DISABLED; ' +
        'relying on client guards + backend authz until a verifier is configured.'
      )
    }
    return passThrough()
  }

  // Routes that need no gating (public pages): attach CSP and pass through without a JWT verify.
  if (!required && !learnerShare && !orgGated && !LOGIN_ROUTES.has(routeKey(pathname))) {
    return passThrough()
  }

  const claims = accessCookie ? await verifyAccessToken(accessCookie) : null
  const authenticatedRole = claims?.role ?? null

  // Đã đăng nhập mà vào bề mặt login (v1 lẫn v2) → về nhà, KHÔNG cho thấy form nữa. Tôn trọng
  // `?next=` (middleware tự đặt khi đá người chưa đăng nhập ra) để deep-link không bị mất.
  if (LOGIN_ROUTES.has(routeKey(pathname)) && authenticatedRole) {
    const next = safeNext(request.nextUrl.searchParams.get('next'))
    return redirectTo(new URL(next ?? v2RoleHome(authenticatedRole), request.url))
  }

  if (!required && !learnerShare && !orgGated) {
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
    // Value-first onboarding: /onboarding (v1) và /v2/onboarding (Galerie) đều mở cho khách chưa có
    // tài khoản. Trang tự chạy funnel guest rồi tự chặn ở bước đăng ký; mọi learner path còn lại
    // vẫn bị đá về login.
    if (GUEST_ONBOARDING_ROUTES.has(routeKey(pathname))) {
      return passThrough()
    }
    // Bề mặt đăng nhập DUY NHẤT từ nay là /v2/login (trang /login legacy đã bị next.config đá sang
    // đây; đá thẳng tới đích để khỏi tốn một chặng redirect).
    const loginUrl = new URL('/v2/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return redirectTo(loginUrl)
  }

  if (learnerShare) {
    if (!allowedOnLearnerPath(authenticatedRole)) {
      return redirectTo(new URL(v2RoleHome(authenticatedRole), request.url))
    }
    return passThrough()
  }

  if (orgGated) {
    // /org/* is gated by the SEPARATE orgRole claim, NOT the global role: the centre owner is global
    // TEACHER and must keep /teacher access. A logged-in user without OWNER/ADMIN orgRole is bounced
    // back to their normal home rather than to login — they ARE authenticated, just not an org admin.
    // Owners reach /org via an in-app link, so we never auto-redirect INTO /org.
    if (claims?.orgRole === 'OWNER' || claims?.orgRole === 'MANAGER') {
      return passThrough()
    }
    return redirectTo(new URL(v2RoleHome(authenticatedRole), request.url))
  }

  if (required !== authenticatedRole) {
    // Sai vai trò trên một trang legacy → về NHÀ Ở V2, không phải trang chủ legacy tương ứng.
    // Đây là mấu chốt của đợt này: mọi ngả đường trong middleware giờ đều đổ về bề mặt v2.
    return redirectTo(new URL(v2RoleHome(authenticatedRole), request.url))
  }

  return passThrough()
}

export const config = {
  // Run on every page so CSP applies site-wide. Exclude Next internals, API routes, and the favicon.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
