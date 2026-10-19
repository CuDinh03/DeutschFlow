import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '@/middleware'
import {
  LOCALE_HEADER,
  hreflangAlternates,
  isLocalizedPublicPath,
  localizedHref,
  splitLocalePrefix,
} from '@/lib/publicLocale'

/**
 * Đợt 1 A+B+E (19/10/2026): trang công khai đã dịch có URL theo ngôn ngữ — `/` (vi), `/en/`, `/de/`.
 * Bot tìm kiếm không có cookie, nên nếu URL không quyết định ngôn ngữ thì Google chỉ thấy tiếng Việt.
 */

function req(path: string, init: { cookie?: string; headers?: Record<string, string> } = {}): NextRequest {
  const headers: Record<string, string> = { ...(init.headers ?? {}) }
  if (init.cookie) headers.cookie = init.cookie
  return new NextRequest(`https://app.test${path}`, { headers })
}

describe('publicLocale — hàm thuần', () => {
  it('tách tiền tố ngôn ngữ, giữ dấu "/" cuối', () => {
    expect(splitLocalePrefix('/en/')).toEqual({ locale: 'en', path: '/' })
    expect(splitLocalePrefix('/de')).toEqual({ locale: 'de', path: '/' })
    expect(splitLocalePrefix('/about/')).toEqual({ locale: null, path: '/about/' })
    // Không nhầm đường bắt đầu bằng "en"/"de" nhưng không phải tiền tố ngôn ngữ.
    expect(splitLocalePrefix('/english/')).toEqual({ locale: null, path: '/english/' })
    expect(splitLocalePrefix('/v2/de/')).toEqual({ locale: null, path: '/v2/de/' })
  })

  it('tiếng Việt không có tiền tố; mọi href có dấu "/" cuối', () => {
    expect(localizedHref('vi', '/')).toBe('/')
    expect(localizedHref('en', '/')).toBe('/en/')
    expect(localizedHref('de', '/trung-tam')).toBe('/de/trung-tam/')
  })

  it('chỉ trang đã dịch bằng catalog mới được bật ngôn ngữ theo URL', () => {
    expect(isLocalizedPublicPath('/')).toBe(true)
    // 19/10/2026: trang Về chúng tôi chuyển sang catalog v2.landing.about ba thứ tiếng.
    expect(isLocalizedPublicPath('/about/')).toBe(true)
    expect(isLocalizedPublicPath('/luyen-thi/')).toBe(false)
    expect(isLocalizedPublicPath('/v2/login/')).toBe(false)
  })

  it('bảng hreflang đủ ba ngôn ngữ và x-default trỏ bản tiếng Việt', () => {
    expect(hreflangAlternates('/')).toEqual({ vi: '/', en: '/en/', de: '/de/', 'x-default': '/' })
  })
})

describe('middleware — ngôn ngữ theo URL', () => {
  it('/en/ rewrite về trang chủ và gắn header ngôn ngữ en', async () => {
    const res = await middleware(req('/en/'))
    expect(res.headers.get('location')).toBeNull()
    expect(res.headers.get('x-middleware-rewrite')).toBe('https://app.test/')
    expect(res.headers.get(`x-middleware-request-${LOCALE_HEADER}`)).toBe('en')
  })

  it('/de/ thắng cả cookie locale=vi', async () => {
    const res = await middleware(req('/de/', { cookie: 'locale=vi' }))
    expect(res.headers.get(`x-middleware-request-${LOCALE_HEADER}`)).toBe('de')
  })

  it('/ không cookie → giữ tiếng Việt, không chuyển hướng', async () => {
    const res = await middleware(req('/'))
    expect(res.headers.get('location')).toBeNull()
    expect(res.headers.get('x-middleware-rewrite')).toBeNull()
  })

  it('/ với cookie locale=en → chuyển sang /en/ để một URL ứng với đúng một ngôn ngữ', async () => {
    const res = await middleware(req('/', { cookie: 'locale=en' }))
    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/en/')
  })

  it('header ngôn ngữ khách tự gửi bị bỏ trên đường không tiền tố', async () => {
    const res = await middleware(req('/', { headers: { [LOCALE_HEADER]: 'de' } }))
    expect(res.headers.get(`x-middleware-request-${LOCALE_HEADER}`)).toBeNull()
  })

  it('trang chưa dịch không bị rewrite theo tiền tố', async () => {
    const res = await middleware(req('/en/luyen-thi/'))
    expect(res.headers.get('x-middleware-rewrite')).toBeNull()
  })

  it('/en/about/ render trang Về chúng tôi bằng tiếng Anh', async () => {
    const res = await middleware(req('/en/about/'))
    expect(res.headers.get('x-middleware-rewrite')).toBe('https://app.test/about/')
    expect(res.headers.get(`x-middleware-request-${LOCALE_HEADER}`)).toBe('en')
  })
})
