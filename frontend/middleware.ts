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
  return new Set(['/dashboard', '/speaking', '/roadmap', '/onboarding'])
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
    console.warn('Middleware: JWT_SECRET is missing. Rejecting token.')
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const required = requiredRole(pathname)
  const learnerShare = requiresLearnerShare(pathname)
  const accessCookie = request.cookies.get(AUTH_ACCESS_COOKIE)?.value

  // Opt-out for public files and internal next paths
  if (pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next()
  }

  const authenticatedRole = accessCookie ? await verifyAccessToken(accessCookie) : null

  if (LOGIN_ROUTES.has(pathname) && authenticatedRole) {
    return NextResponse.redirect(new URL(roleHome(authenticatedRole), request.url))
  }

  if (!required && !learnerShare) {
    return NextResponse.next()
  }

  if (!authenticatedRole) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (learnerShare) {
    if (!allowedOnLearnerPath(authenticatedRole)) {
      return NextResponse.redirect(new URL(roleHome(authenticatedRole), request.url))
    }
    return NextResponse.next()
  }

  if (required !== authenticatedRole) {
    // If user is STUDENT but tries to access /admin, send them back to /dashboard
    // instead of a potential redirect loop to /student
    return NextResponse.redirect(new URL(roleHome(authenticatedRole), request.url))
  }

  const response = NextResponse.next()
  return response
}

export const config = {
  matcher: [
    '/student/:path*', 
    '/teacher/:path*', 
    '/admin/:path*', 
    '/onboarding', 
    '/login', 
    '/register', 
    '/dashboard', 
    '/speaking', 
    '/roadmap'
  ],
}

