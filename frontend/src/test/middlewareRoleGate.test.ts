// @vitest-environment node
// jsdom cấp TextEncoder ở realm khác nên jose từ chối payload khi ký — ca này chạy trong node.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SignJWT, exportSPKI, generateKeyPair } from 'jose'

/**
 * Cổng vai trò tầng biên cho `/v2/*` — và cổng giữ cho đường đi của khoá công khai.
 *
 * Sự cố 07/09/2026: `JWT_RSA_PUBLIC_KEY` đã đặt trong Amplify console, dựng lại hai lần, mà cổng
 * vẫn tắt. Nguyên nhân đo được: Next KHÔNG nhúng biến này vào gói middleware — dựng với biến qua
 * shell và qua `.env.production` đều để nguyên `process.env.JWT_RSA_PUBLIC_KEY` là tra cứu LÚC
 * CHẠY, mà biến console của Amplify chỉ sống trong container dựng. Kết quả: `hasVerifierForV2`
 * false → `passThrough()` → học viên mở được vỏ `/v2/admin`. Khai báo `env` trong
 * `next.config.mjs` buộc Next thay giá trị thật vào gói lúc dựng.
 *
 * Ca cuối là ca giữ mạng lưới: gỡ khai báo đó đi thì cổng lại tắt lặng trên prod, không test nào
 * khác đỏ vì tại chỗ biến vẫn đọc được từ `.env`.
 */

const ORIGINAL_ENV = { ...process.env }
const ADMIN_URL = 'https://mydeutschflow.com/v2/admin/'

async function keyAndToken(role: string) {
  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true })
  const token = await new SignJWT({ role })
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject('hocvien@example.com')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey)
  // Đúng dạng biến môi trường thật: PEM một dòng, xuống dòng ở dạng thoát.
  return { escapedPem: (await exportSPKI(publicKey)).replace(/\n/g, '\\n'), token }
}

async function callAdmin(env: Record<string, string | undefined>, cookies: Record<string, string>) {
  vi.resetModules()
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  const { middleware } = await import('@/middleware')
  const { NextRequest } = await import('next/server')
  const request = new NextRequest(ADMIN_URL)
  for (const [k, v] of Object.entries(cookies)) request.cookies.set(k, v)
  return middleware(request)
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_BACKEND_URL = 'https://api.mydeutschflow.com/api'
  // Máy dev có JWT_SECRET trong frontend/.env — xoá để ca "không bộ kiểm" đo đúng thứ nó định đo.
  delete process.env.JWT_SECRET
  delete process.env.JWT_RSA_PUBLIC_KEY
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.resetModules()
})

describe('middleware — cổng vai trò /v2 khi có khoá RS256', () => {
  it('học viên vào /v2/admin/ bị đá về trang chủ học viên ngay ở tầng biên', async () => {
    const { escapedPem, token } = await keyAndToken('STUDENT')

    const res = await callAdmin({ JWT_RSA_PUBLIC_KEY: escapedPem }, { auth_access: token })

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://mydeutschflow.com/v2/student/dashboard')
  })

  it('admin thật vẫn vào được', async () => {
    const { escapedPem, token } = await keyAndToken('ADMIN')

    const res = await callAdmin({ JWT_RSA_PUBLIC_KEY: escapedPem }, { auth_access: token })

    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it('thẻ rác mà không có cookie làm mới thì về /v2/login — đây là phép đo dùng trên prod', async () => {
    const { escapedPem } = await keyAndToken('STUDENT')

    const res = await callAdmin({ JWT_RSA_PUBLIC_KEY: escapedPem }, { auth_access: 'khong-phai-jwt' })

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/v2/login')
  })

  it('KHÔNG có bộ kiểm nào: cho qua — chính là trạng thái hỏng đã đo trên prod', async () => {
    const { token } = await keyAndToken('STUDENT')

    const res = await callAdmin({}, { auth_access: token })

    // Nhánh degrade cố ý (backend vẫn gác dữ liệu), nhưng cổng biên mất. Ca này khoá lại ý nghĩa
    // của phép đo: thẻ rác + không refresh trả 200 nghĩa là KHÔNG có khoá, chứ không phải khoá sai.
    expect(res.status).toBe(200)
  })
})

describe('next.config.mjs — đường đi của khoá xuống gói middleware', () => {
  it('khai báo env.JWT_RSA_PUBLIC_KEY để Next nhúng giá trị lúc dựng', async () => {
    const config = (await import('../../next.config.mjs')).default

    expect(config.env).toBeDefined()
    expect(Object.keys(config.env as Record<string, string>)).toContain('JWT_RSA_PUBLIC_KEY')
  })

  it('KHÔNG nhúng JWT_SECRET — bí mật thì không đưa vào tạo phẩm dựng', async () => {
    const config = (await import('../../next.config.mjs')).default

    expect(Object.keys(config.env as Record<string, string>)).not.toContain('JWT_SECRET')
  })
})
