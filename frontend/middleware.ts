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

function requiredRole(pathname: string): Role | null {
  if (pathname.startsWith('/admin')) return 'ADMIN'
  if (pathname.startsWith('/teacher')) return 'TEACHER'
  if (pathname.startsWith('/student')) return 'STUDENT'
  if (pathname === '/onboarding') return 'STUDENT'
  return null
}

function normalizeRole(value: unknown): Role | null {
  const role = String(value ?? '').trim().toUpperCase()
  if (role === 'ADMIN' || role === 'TEACHER' || role === 'STUDENT') return role
  return null
}

async function verifyAccessToken(token: string): Promise<Role | null> {
  const secret = process.env.JWT_SECRET
  if (!secret) return null
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
    return normalizeRole(payload.role)
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const required = requiredRole(pathname)
  const accessCookie = request.cookies.get(AUTH_ACCESS_COOKIE)?.value
  const roleCookie = normalizeRole(request.cookies.get(AUTH_ROLE_COOKIE)?.value)

  const authenticatedRole = accessCookie ? await verifyAccessToken(accessCookie) : null

  if (LOGIN_ROUTES.has(pathname) && authenticatedRole) {
    return NextResponse.redirect(new URL(roleHome(authenticatedRole), request.url))
  }

  if (!required) {
    return NextResponse.next()
  }

  if (!authenticatedRole) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (required !== authenticatedRole) {
    return NextResponse.redirect(new URL(roleHome(authenticatedRole), request.url))
  }

  const response = NextResponse.next()
  if (roleCookie !== authenticatedRole) {
    response.cookies.set(AUTH_ROLE_COOKIE, authenticatedRole, {
      path: '/',
      sameSite: 'lax',
      maxAge: 15 * 60,
    })
  }
  return response
}

export const config = {
  matcher: ['/student/:path*', '/teacher/:path*', '/admin/:path*', '/onboarding', '/login', '/register'],
}

