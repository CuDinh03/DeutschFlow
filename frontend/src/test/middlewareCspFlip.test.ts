import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Cổng an toàn cho E4 (flip CSP enforce qua env `CSP_ENFORCE`).
 *
 * Vì sao cần: `cspEnforceEnabled` đọc `process.env.CSP_ENFORCE` ở MODULE SCOPE — giá trị chốt lúc
 * instance compute khởi động, nên không thể thử bằng cách đổi env lúc chạy. Mỗi ca ở đây phải
 * `vi.resetModules()` rồi import lại middleware sau khi đã đặt env, đúng như một lần redeploy.
 *
 * Ca (3) là ca giữ mạng lưới: mặc định TẮT. Nếu ai đó lỡ đảo điều kiện (ví dụ `!== '0'`), prod
 * bật enforce ngoài ý muốn mà không qua gate Q2 — hỏng ngầm, chỉ lộ khi tài nguyên bị chặn thật.
 */

const ORIGINAL_ENV = { ...process.env }

/** Trang bất kỳ đi qua middleware; không dùng route gated để khỏi dính nhánh redirect auth. */
const PAGE_URL = 'https://mydeutschflow.com/privacy/'

async function runMiddleware(env: Record<string, string | undefined>) {
  vi.resetModules()
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  const { middleware } = await import('@/middleware')
  const { NextRequest } = await import('next/server')
  return middleware(new NextRequest(PAGE_URL))
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_BACKEND_URL = 'https://api.mydeutschflow.com/api'
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.resetModules()
})

describe('middleware — kill-switch CSP_ENFORCE (gate E4)', () => {
  it('mặc định (không đặt env): KHÔNG gửi Content-Security-Policy, chỉ Report-Only', async () => {
    const res = await runMiddleware({ CSP_ENFORCE: undefined })

    expect(res.headers.get('content-security-policy')).toBeNull()
    expect(res.headers.get('content-security-policy-report-only')).toContain("default-src 'self'")
  })

  it('CSP_ENFORCE=1: gửi ĐÚNG MỘT header CSP thật, nội dung y hệt bản Report-Only', async () => {
    const res = await runMiddleware({ CSP_ENFORCE: '1' })

    const enforced = res.headers.get('content-security-policy')
    const reportOnly = res.headers.get('content-security-policy-report-only')

    expect(enforced).not.toBeNull()
    // Headers.get gộp trùng lặp bằng ", " — chuỗi này xuất hiện nghĩa là có HAI chính sách chồng nhau,
    // tức mất tính "đúng một header" mà E4.0 đã đo.
    expect(enforced).not.toContain(", default-src")
    // Giữ song song Report-Only để đối chiếu trong tuần đầu sau khi bật.
    expect(reportOnly).toBe(enforced)
  })

  it('giá trị env khác "1" (kể cả "true"/"0") vẫn TẮT — mặc định phải fail-safe', async () => {
    for (const value of ['0', 'true', 'yes', '']) {
      const res = await runMiddleware({ CSP_ENFORCE: value })
      expect(res.headers.get('content-security-policy')).toBeNull()
    }
  })

  it('chính sách strict khai đủ 4 directive mà bản floor không có', async () => {
    const res = await runMiddleware({ CSP_ENFORCE: '1' })
    const csp = res.headers.get('content-security-policy') ?? ''

    // worker-src: dưới strict-dynamic, `new Worker()` rơi về script-src nơi 'self' bị bỏ qua → chết.
    expect(csp).toContain("worker-src 'self' blob:")
    // frame-src/media-src: material reader nhúng S3 presigned; thiếu là chặn thật ngày bật enforce.
    expect(csp).toContain("frame-src 'self' https:")
    expect(csp).toContain("media-src 'self' blob: data: https:")
    // nonce phải có, nếu không mọi inline script của Next chết ngay khi enforce.
    expect(csp).toMatch(/script-src [^;]*'nonce-[^']+'/)
  })

  it('nonce đổi mỗi request (không tái dùng giữa hai lần gọi)', async () => {
    const grab = (h: string | null) => h?.match(/'nonce-([^']+)'/)?.[1]

    const a = await runMiddleware({ CSP_ENFORCE: '1' })
    const { middleware } = await import('@/middleware')
    const { NextRequest } = await import('next/server')
    const b = await middleware(new NextRequest(PAGE_URL))

    const nonceA = grab(a.headers.get('content-security-policy'))
    const nonceB = grab(b.headers.get('content-security-policy'))

    expect(nonceA).toBeTruthy()
    expect(nonceB).toBeTruthy()
    expect(nonceA).not.toBe(nonceB)
  })

  it('trỏ vi phạm về collector: report-uri + report-to + Reporting-Endpoints', async () => {
    const res = await runMiddleware({ CSP_ENFORCE: '1' })
    const csp = res.headers.get('content-security-policy') ?? ''

    expect(csp).toContain('report-uri https://api.mydeutschflow.com/api/public/csp-report')
    expect(csp).toContain('report-to csp')
    expect(res.headers.get('reporting-endpoints')).toBe(
      'csp="https://api.mydeutschflow.com/api/public/csp-report"',
    )
  })
})
