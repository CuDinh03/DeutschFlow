// @vitest-environment node
// jsdom cấp TextEncoder ở realm khác nên jose từ chối payload khi ký — ca này chạy trong node.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SignJWT } from 'jose'

/**
 * Cookie `auth_support` (phiên hỗ trợ chỉ-đọc, V370) ở cổng biên `/v2/*`.
 *
 * Tab hỗ trợ và tab admin dùng chung cookie: tab hỗ trợ mang cả `auth_access` (ADMIN) lẫn `auth_support`
 * (token typ=support của người dùng). Luật: ngoài `/v2/admin/**`, khi `auth_access` là ADMIN và `auth_support`
 * hợp lệ → định tuyến theo vai trò người dùng; `/v2/admin/**` luôn theo `auth_access`; trình duyệt của người dùng
 * thường (auth_access không phải ADMIN) bỏ qua `auth_support`.
 */

const SECRET = 'abcdefghijklmnopqrstuvwxyz0123456789abcdef'
const ORIGINAL_ENV = { ...process.env }

async function sign(claims: Record<string, unknown>, exp: string | number = '1h') {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('someone@example.com')
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(SECRET))
}

async function call(path: string, cookies: Record<string, string>) {
  vi.resetModules()
  const { middleware } = await import('@/middleware')
  const { NextRequest } = await import('next/server')
  const request = new NextRequest(`https://mydeutschflow.com${path}`)
  for (const [k, v] of Object.entries(cookies)) request.cookies.set(k, v)
  return middleware(request)
}

function redirectedTo(res: Response): string | null {
  const loc = res.headers.get('location')
  return loc ? new URL(loc).pathname : null
}

let adminAccess: string
let studentSupport: string

beforeEach(async () => {
  process.env.NEXT_PUBLIC_BACKEND_URL = 'https://api.mydeutschflow.com/api'
  process.env.JWT_SECRET = SECRET
  delete process.env.JWT_RSA_PUBLIC_KEY
  adminAccess = await sign({ typ: 'access', role: 'ADMIN', mfa: true })
  studentSupport = await sign({ typ: 'support', role: 'STUDENT', sup: 77, act: 1, userId: 9 })
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.resetModules()
})

describe('middleware — cookie auth_support', () => {
  it('tab hỗ trợ (auth_access ADMIN + auth_support STUDENT) vào được khu học viên', async () => {
    const res = await call('/v2/student/dashboard/', { auth_access: adminAccess, auth_support: studentSupport })
    expect(redirectedTo(res)).toBeNull()
  })

  it('không có auth_support: admin vào khu học viên bị đưa về nhà admin như cũ', async () => {
    const res = await call('/v2/student/dashboard/', { auth_access: adminAccess })
    expect(redirectedTo(res)).toBe('/v2/admin/users')
  })

  it('/v2/admin/** luôn theo auth_access — token support không bao giờ mở hay chặn khu quản trị', async () => {
    const res = await call('/v2/admin/users/', { auth_access: adminAccess, auth_support: studentSupport })
    expect(redirectedTo(res)).toBeNull()
  })

  it('tab hỗ trợ của học viên vào khu giáo viên → về nhà của HỌC VIÊN', async () => {
    const res = await call('/v2/teacher/', { auth_access: adminAccess, auth_support: studentSupport })
    expect(redirectedTo(res)).toBe('/v2/student/dashboard')
  })

  it('trình duyệt của người dùng thường: auth_support bị bỏ qua', async () => {
    const studentAccess = await sign({ typ: 'access', role: 'STUDENT' })
    const teacherSupport = await sign({ typ: 'support', role: 'TEACHER', sup: 1, act: 1, userId: 2 })
    const res = await call('/v2/teacher/', { auth_access: studentAccess, auth_support: teacherSupport })
    expect(redirectedTo(res)).toBe('/v2/student/dashboard')
  })

  it('auth_support hết hạn, sai chữ ký, sai loại, hoặc vai trò ADMIN → bị bỏ qua', async () => {
    const expired = await sign({ typ: 'support', role: 'STUDENT' }, Math.floor(Date.now() / 1000) - 60)
    const wrongType = await sign({ typ: 'access', role: 'STUDENT' })
    const adminSupport = await sign({ typ: 'support', role: 'ADMIN' })
    const forged = await new SignJWT({ typ: 'support', role: 'STUDENT' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('another-secret-another-secret-another-secret'))
    for (const bad of [expired, wrongType, adminSupport, forged]) {
      const res = await call('/v2/student/dashboard/', { auth_access: adminAccess, auth_support: bad })
      expect(redirectedTo(res)).toBe('/v2/admin/users')
    }
  })

  it('token support đặt vào auth_access vẫn KHÔNG phải access token', async () => {
    const res = await call('/v2/student/dashboard/', { auth_access: studentSupport })
    expect(redirectedTo(res)).toBe('/v2/login')
  })
})
