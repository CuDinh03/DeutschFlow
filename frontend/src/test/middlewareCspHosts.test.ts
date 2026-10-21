import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mediaOrigins, mediaRemotePatterns } from '../../media-origins.mjs'

/**
 * E5 đường 1 (owner chọn 08/09/2026) — siết bản **Report-Only** để soak E3 đo được HOST.
 *
 * Vì sao cần cổng này: soak chạy 7 ngày ra 0 vi phạm, nhưng con số 0 đó vô nghĩa vì chính sách còn
 * `https:` ở `img-src`/`connect-src`/`frame-src`/`media-src` — mọi host đều hợp lệ nên không bao giờ
 * bị báo. Ai vô tình thêm `https:` lại (hoặc merge nhầm bản cũ) sẽ làm soak im lặng trở lại mà không
 * ai biết: đó là hỏng-lặng, đúng loại lỗi phải có test chặn.
 *
 * `buildCsp` đọc env ở module scope nên mỗi ca phải `vi.resetModules()` rồi import lại middleware —
 * cùng cách với `middlewareCspFlip.test.ts`.
 */

const ORIGINAL_ENV = { ...process.env }
const PAGE_URL = 'https://mydeutschflow.com/privacy/'

// Kho media là Cloudflare R2 (rời AWS) — host lấy từ NEXT_PUBLIC_MEDIA_ORIGINS lúc dựng.
const R2_ORIGIN = 'https://acct123.r2.cloudflarestorage.com'

async function reportOnlyPolicy(env: Record<string, string | undefined> = {}): Promise<string> {
  vi.resetModules()
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  const { middleware } = await import('@/middleware')
  const { NextRequest } = await import('next/server')
  const res = await middleware(new NextRequest(PAGE_URL))
  return res.headers.get('content-security-policy-report-only') ?? ''
}

/** Lấy đúng một directive ra khỏi chuỗi chính sách (`img-src 'self' data: …`). */
function directive(policy: string, name: string): string {
  const found = policy
    .split(';')
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `))
  return found ?? ''
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_BACKEND_URL = 'https://api.mydeutschflow.com/api'
  process.env.NEXT_PUBLIC_MEDIA_ORIGINS = R2_ORIGIN
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.resetModules()
})

describe('CSP Report-Only — đủ chặt để soak nói được về host', () => {
  it('bốn directive nguồn KHÔNG còn ký tự đại diện `https:`', async () => {
    const policy = await reportOnlyPolicy()

    for (const name of ['img-src', 'connect-src', 'frame-src', 'media-src']) {
      const value = directive(policy, name)
      expect(value, `${name} phải tồn tại`).not.toBe('')
      // `https:` đứng riêng như một source expression; `https://host` thì không tính.
      expect(value.split(/\s+/), `${name} còn wildcard https: ⇒ soak lại mù host`).not.toContain(
        'https:',
      )
    }
  })

  it('kho media R2 được nêu đích danh ở img/media/frame/connect (thiếu là mở PDF/audio hay PUT tệp bị chặn)', async () => {
    const policy = await reportOnlyPolicy()

    for (const name of ['img-src', 'media-src', 'frame-src', 'connect-src']) {
      expect(directive(policy, name).split(/\s+/), `${name} thiếu ${R2_ORIGIN}`).toContain(R2_ORIGIN)
    }
  })

  it('không còn host AWS nào (S3/CloudFront) trong chính sách', async () => {
    const policy = await reportOnlyPolicy({ NEXT_PUBLIC_CLOUDFRONT_URL: 'https://d123.cloudfront.net' })

    expect(policy).not.toContain('amazonaws.com')
    expect(policy).not.toContain('cloudfront.net')
  })

  it('NEXT_PUBLIC_MEDIA_ORIGINS trống thì các directive vẫn hợp lệ, không sinh nguồn rỗng', async () => {
    const policy = await reportOnlyPolicy({ NEXT_PUBLIC_MEDIA_ORIGINS: undefined })

    for (const name of ['img-src', 'media-src', 'frame-src', 'connect-src']) {
      expect(directive(policy, name), name).not.toMatch(/\s{2,}|\s$/)
    }
  })

  it('frame-src lấy host dashboard PostHog THẬT (us.posthog.com), không phải api_host', async () => {
    const policy = await reportOnlyPolicy({
      NEXT_PUBLIC_POSTHOG_SHARED_DASHBOARD_URL: 'https://us.posthog.com/shared/abc123',
      NEXT_PUBLIC_POSTHOG_HOST: 'https://us.i.posthog.com',
    })

    const frameSrc = directive(policy, 'frame-src')
    expect(frameSrc.split(/\s+/)).toContain('https://us.posthog.com')
    // Bẫy E5 §2: copy host PostHog từ connect-src sang là chặn trang analytics của admin.
    expect(frameSrc).not.toContain('https://us.i.posthog.com')
    // Chỉ lấy origin, không mang theo đường dẫn chia sẻ.
    expect(frameSrc).not.toContain('/shared/')
  })

  it('URL dashboard hỏng hoặc bỏ trống thì frame-src vẫn hợp lệ, không sinh chuỗi rỗng', async () => {
    const policy = await reportOnlyPolicy({
      NEXT_PUBLIC_POSTHOG_SHARED_DASHBOARD_URL: 'không-phải-url',
    })

    const frameSrc = directive(policy, 'frame-src')
    expect(frameSrc.startsWith("frame-src 'self'")).toBe(true)
    expect(frameSrc).not.toMatch(/\s{2,}/)
  })

  it('font Google đã bỏ khỏi style-src/font-src (font là self-host)', async () => {
    const policy = await reportOnlyPolicy()

    expect(directive(policy, 'style-src')).toBe("style-src 'self' 'unsafe-inline'")
    expect(directive(policy, 'font-src')).toBe("font-src 'self' data:")
    expect(policy).not.toContain('fonts.googleapis.com')
    expect(policy).not.toContain('fonts.gstatic.com')
  })

  it('script-src GIỮ NGUYÊN nonce + strict-dynamic — đợt này không đụng tới', async () => {
    const policy = await reportOnlyPolicy()
    const scriptSrc = directive(policy, 'script-src')

    expect(scriptSrc).toContain("'strict-dynamic'")
    expect(scriptSrc).toMatch(/'nonce-[^']+'/)
  })

})

describe('Đối chiếu chéo với next.config.mjs', () => {
  // Neo theo vị trí tệp test, KHÔNG theo `process.cwd()`: chạy vitest từ gốc repo thì cwd khác
  // và ca này sẽ đỏ oan (đã có vài ca cũ trong repo dính đúng bẫy đó).
  const nextConfig = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'next.config.mjs'),
    'utf8',
  )

  it('`images.remotePatterns` lấy từ cùng module với CSP — hai nơi không được trôi khỏi nhau', () => {
    expect(nextConfig).toContain("from './media-origins.mjs'")
    expect(nextConfig).toContain('remotePatterns: mediaRemotePatterns()')
    // Không còn hostname chép tay nào (trước đây là hai host S3).
    expect(nextConfig).not.toMatch(/hostname:\s*'/)
  })

  it('mediaOrigins: chỉ nhận https, bỏ mục hỏng, bỏ đường dẫn, khử trùng', () => {
    expect(
      mediaOrigins(` ${R2_ORIGIN}/deutschflow-media/ , http://evil.test, không-phải-url, ${R2_ORIGIN}`),
    ).toEqual([R2_ORIGIN])
    expect(mediaOrigins('')).toEqual([])
    expect(mediaOrigins(' , ')).toEqual([])
    expect(mediaRemotePatterns(R2_ORIGIN)).toEqual([
      { protocol: 'https', hostname: 'acct123.r2.cloudflarestorage.com', pathname: '/**' },
    ])
  })

  it('`CSP_ENFORCE` được khai báo trong `env` — không khai thì kill-switch E4 vô tác dụng trên Amplify', () => {
    // Bài học 07/09 (JWT_RSA_PUBLIC_KEY): biến của Amplify console chỉ sống trong container dựng;
    // `process.env.X` tra lúc chạy trong middleware KHÔNG bao giờ thấy. Phải khai ở `env` để Next
    // nhúng giá trị vào gói middleware lúc dựng.
    const envBlock = nextConfig.slice(nextConfig.indexOf('env: {'), nextConfig.indexOf('images: {'))
    expect(envBlock).toContain('CSP_ENFORCE')
  })
})
