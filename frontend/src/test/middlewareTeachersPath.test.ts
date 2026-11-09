// @vitest-environment node
// jsdom cấp TextEncoder ở realm khác nên jose từ chối payload khi ký — ca này chạy trong node.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SignJWT } from 'jose'

/**
 * Cổng vai trò khớp theo NGUYÊN đoạn đường dẫn (09/11/2026). Trước đây `startsWith('/teacher')` khớp cả
 * `/teachers/…` (hồ sơ giáo viên công khai): học viên bị đá về Dashboard, khách bị đá sang đăng nhập.
 * Khu giáo viên thật (`/teacher/…`, `/v2/teacher/…`) vẫn phải chặn như cũ.
 */

const ORIGINAL_ENV = { ...process.env }
const SECRET = 'khoa-thu-middleware-teachers'

async function token(role: string) {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('nguoidung@example.test')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRET))
}

async function call(path: string, role?: string) {
  vi.resetModules()
  process.env.JWT_SECRET = SECRET
  const { middleware } = await import('@/middleware')
  const { NextRequest } = await import('next/server')
  const request = new NextRequest(`https://mydeutschflow.com${path}`)
  if (role) {
    request.cookies.set('auth_access', await token(role))
    request.cookies.set('auth_role', role)
  }
  return middleware(request)
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_BACKEND_URL = 'https://api.mydeutschflow.com/api'
  delete process.env.JWT_RSA_PUBLIC_KEY
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.resetModules()
})

describe('middleware — /teachers không phải khu giáo viên', () => {
  it('khách mở /teachers/5/ không bị đá sang đăng nhập', async () => {
    const res = await call('/teachers/5/')
    expect(res.headers.get('location')).toBeNull()
  })

  it('học viên mở /teachers/5/ không bị đá về Dashboard', async () => {
    const res = await call('/teachers/5/', 'STUDENT')
    expect(res.headers.get('location')).toBeNull()
  })

  it('khu giáo viên thật vẫn chặn: khách ở /teacher/ sang đăng nhập, học viên ở /v2/teacher/ về nhà', async () => {
    const guest = await call('/teacher/')
    expect(guest.headers.get('location')).toContain('/v2/login')

    const student = await call('/v2/teacher/', 'STUDENT')
    expect(student.headers.get('location')).toBe('https://mydeutschflow.com/v2/student/dashboard')
  })

  it('giáo viên vẫn vào khu của mình', async () => {
    const res = await call('/v2/teacher/', 'TEACHER')
    expect(res.headers.get('location')).toBeNull()
  })
})
